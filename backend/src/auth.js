import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const sessionCookieName = 'feel_flow_session'
const sessionDurations = {
  regular: 12 * 60 * 60 * 1000,
  remember: 30 * 24 * 60 * 60 * 1000,
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derivedKey = await scrypt(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltHex, hashHex] = storedHash.split(':')
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false

  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=')
    if (separatorIndex < 0) continue
    if (cookie.slice(0, separatorIndex).trim() === name) {
      return cookie.slice(separatorIndex + 1).trim()
    }
  }

  return null
}

function setSessionCookie(response, token, maxAge, secure) {
  const attributes = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ]
  if (secure) attributes.push('Secure')
  response.setHeader('Set-Cookie', attributes.join('; '))
}

function clearSessionCookie(response, secure) {
  const attributes = [
    `${sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (secure) attributes.push('Secure')
  response.setHeader('Set-Cookie', attributes.join('; '))
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    fitness: JSON.parse(user.fitness_json),
    preferences: JSON.parse(user.preferences_json),
  }
}

function issueSession(database, response, userId, remember, secureCookie) {
  const token = randomBytes(32).toString('base64url')
  const duration = remember ? sessionDurations.remember : sessionDurations.regular
  database.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  ).run(hashToken(token), userId, Date.now() + duration)
  setSessionCookie(response, token, duration, secureCookie)
}

export function createAuthHandlers(database, { secureCookie = false } = {}) {
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())

  return {
    async register(request, response) {
      const { name, email, password, fitness, preferences } = request.body ?? {}
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
      const normalizedName = typeof name === 'string' ? name.trim() : ''

      if (normalizedName.length < 2 || normalizedName.length > 80) {
        return response.status(400).json({ error: 'Ingresá tu nombre y apellido.' })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
        return response.status(400).json({ error: 'Ingresá un correo electrónico válido.' })
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return response.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres.' })
      }
      if (!fitness || typeof fitness !== 'object' || Array.isArray(fitness)
        || !preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
        return response.status(400).json({ error: 'Completá tu perfil y tus preferencias.' })
      }

      const passwordHash = await hashPassword(password)
      const insertUser = database.prepare(`
        INSERT INTO users (name, email, password_hash, fitness_json, preferences_json)
        VALUES (?, ?, ?, ?, ?)
      `)
      const createAccount = database.transaction(() => {
        const result = insertUser.run(
          normalizedName,
          normalizedEmail,
          passwordHash,
          JSON.stringify(fitness),
          JSON.stringify(preferences),
        )
        return Number(result.lastInsertRowid)
      })

      try {
        const userId = createAccount()
        const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        issueSession(database, response, userId, true, secureCookie)
        return response.status(201).json({ user: publicUser(user) })
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return response.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' })
        }
        throw error
      }
    },

    async login(request, response) {
      const email = typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : ''
      const password = request.body?.password
      if (!email || typeof password !== 'string') {
        return response.status(400).json({ error: 'Ingresá tu correo y contraseña.' })
      }

      const user = database.prepare('SELECT * FROM users WHERE email = ?').get(email)
      const isValid = user && await verifyPassword(password, user.password_hash)
      if (!isValid) {
        return response.status(401).json({ error: 'El correo o la contraseña no son correctos.' })
      }

      const remember = request.body?.remember === true
      issueSession(database, response, user.id, remember, secureCookie)
      return response.json({ user: publicUser(user) })
    },

    me(request, response) {
      const token = getCookie(request, sessionCookieName)
      if (!token) return response.status(401).json({ error: 'Iniciá sesión para continuar.' })

      const session = database.prepare(`
        SELECT users.*, sessions.token_hash, sessions.expires_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
      `).get(hashToken(token), Date.now())

      if (!session) {
        clearSessionCookie(response, secureCookie)
        return response.status(401).json({ error: 'Tu sesión venció. Iniciá sesión nuevamente.' })
      }

      return response.json({ user: publicUser(session) })
    },

    logout(request, response) {
      const token = getCookie(request, sessionCookieName)
      if (token) {
        database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
      }
      clearSessionCookie(response, secureCookie)
      return response.status(204).end()
    },
  }
}

export { sessionCookieName }
