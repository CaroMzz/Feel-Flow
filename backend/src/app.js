import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createAuthHandlers } from './auth.js'

function getSessionToken(request) {
  for (const cookie of (request.headers.cookie ?? '').split(';')) {
    const separatorIndex = cookie.indexOf('=')
    if (separatorIndex >= 0 && cookie.slice(0, separatorIndex).trim() === 'feel_flow_session') {
      return cookie.slice(separatorIndex + 1).trim()
    }
  }
  return null
}

export function createApp(database, { secureCookie = false } = {}) {
  const app = express()
  const auth = createAuthHandlers(database, { secureCookie })

  app.disable('x-powered-by')
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:'],
      },
    },
  }))
  app.use(express.json({ limit: '16kb' }))

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Esperá unos minutos e intentá nuevamente.' },
  })

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
  app.post('/api/auth/register', authLimiter, auth.register)
  app.post('/api/auth/login', authLimiter, auth.login)
  app.get('/api/auth/me', auth.me)
  app.post('/api/auth/logout', auth.logout)

  function requireUser(request, response, next) {
    const token = getSessionToken(request)
    if (!token) return response.status(401).json({ error: 'Iniciá sesión para continuar.' })

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const session = database.prepare(`
      SELECT users.id, users.name, users.email, users.fitness_json, users.preferences_json
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(tokenHash, Date.now())

    if (!session) return response.status(401).json({ error: 'Tu sesión venció. Iniciá sesión nuevamente.' })
    request.user = session
    return next()
  }

  app.get('/api/dashboard', requireUser, (request, response) => {
    const year = Number(request.query.year)
    const month = Number(request.query.month)
    if (!Number.isInteger(year) || year < 2000 || year > 2100
      || !Number.isInteger(month) || month < 1 || month > 12) {
      return response.status(400).json({ error: 'Indicá un mes y un año válidos.' })
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
    const workouts = database.prepare(`
      SELECT id, day, name, icon, completed_exercises AS completed, total_exercises AS exercises
      FROM workouts WHERE user_id = ? ORDER BY id
    `).all(request.user.id)
    const attendance = database.prepare(`
      SELECT attended_on AS date, kilograms_lifted AS kilogramsLifted
      FROM attendance
      WHERE user_id = ? AND attended_on >= ? AND attended_on < ?
      ORDER BY attended_on
    `).all(request.user.id, startDate, endDate)

    return response.json({
      user: {
        id: request.user.id,
        name: request.user.name,
        email: request.user.email,
        fitness: JSON.parse(request.user.fitness_json),
        preferences: JSON.parse(request.user.preferences_json),
      },
      workouts,
      attendance,
      kilogramsLifted: attendance.reduce((sum, item) => sum + item.kilogramsLifted, 0),
    })
  })

  app.post('/api/workouts', requireUser, (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
    const day = typeof request.body?.day === 'string' ? request.body.day : ''
    const validDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

    if (name.length < 2 || name.length > 60 || !validDays.includes(day)) {
      return response.status(400).json({ error: 'Ingresá un nombre y un día válidos para la rutina.' })
    }

    const result = database.prepare(`
      INSERT INTO workouts (user_id, day, name, icon, completed_exercises, total_exercises)
      VALUES (?, ?, ?, ?, 0, 1)
    `).run(request.user.id, day, name, '🏋🏻‍♀️')
    const workout = database.prepare(`
      SELECT id, day, name, icon, completed_exercises AS completed, total_exercises AS exercises
      FROM workouts WHERE id = ? AND user_id = ?
    `).get(Number(result.lastInsertRowid), request.user.id)

    return response.status(201).json({ workout })
  })

  app.post('/api/workouts/:id/exercises', requireUser, (request, response) => {
    const workoutId = Number(request.params.id)
    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return response.status(400).json({ error: 'La rutina no es válida.' })
    }

    const result = database.prepare(`
      UPDATE workouts SET total_exercises = total_exercises + 1
      WHERE id = ? AND user_id = ?
    `).run(workoutId, request.user.id)
    if (result.changes === 0) return response.status(404).json({ error: 'No encontramos esa rutina.' })

    const workout = database.prepare(`
      SELECT id, day, name, icon, completed_exercises AS completed, total_exercises AS exercises
      FROM workouts WHERE id = ? AND user_id = ?
    `).get(workoutId, request.user.id)
    return response.status(201).json({ workout })
  })

  app.post('/api/workouts/:id/complete', requireUser, (request, response) => {
    const workoutId = Number(request.params.id)
    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return response.status(400).json({ error: 'La rutina no es válida.' })
    }

    const completeWorkout = database.transaction(() => {
      const workout = database.prepare(`
        SELECT id FROM workouts WHERE id = ? AND user_id = ?
      `).get(workoutId, request.user.id)
      if (!workout) return false

      database.prepare(`
        UPDATE workouts SET completed_exercises = total_exercises WHERE id = ? AND user_id = ?
      `).run(workoutId, request.user.id)
      database.prepare(`
        INSERT INTO attendance (user_id, attended_on)
        VALUES (?, date('now', 'localtime'))
        ON CONFLICT (user_id, attended_on) DO NOTHING
      `).run(request.user.id)
      return true
    })

    if (!completeWorkout()) return response.status(404).json({ error: 'No encontramos esa rutina.' })
    return response.json({ message: '¡Rutina completada!' })
  })

  const frontendDirectory = path.resolve(import.meta.dirname, '../../frontend/dist')
  const frontendEntry = path.join(frontendDirectory, 'index.html')
  if (existsSync(frontendEntry)) {
    app.use(express.static(frontendDirectory))
    app.get(/^(?!\/api).*/, (_request, response) => response.sendFile(frontendEntry))
  }

  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'El contenido enviado no es válido.' })
    }
    if (error.type === 'entity.too.large') {
      return response.status(413).json({ error: 'La solicitud es demasiado grande.' })
    }
    console.error('Request failed:', error.message)
    return response.status(500).json({ error: 'Ocurrió un error inesperado. Intentá nuevamente.' })
  })

  return app
}
