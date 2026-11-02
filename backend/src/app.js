import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createAuthHandlers } from './auth.js'

const workoutDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const supportedMediaTypes = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (file) => file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (file) => file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { extension: 'webp', signature: (file) => file.toString('ascii', 0, 4) === 'RIFF' && file.toString('ascii', 8, 12) === 'WEBP' }],
  ['video/mp4', { extension: 'mp4', signature: (file) => file.toString('ascii', 4, 8) === 'ftyp' }],
  ['video/webm', { extension: 'webm', signature: (file) => file.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) }],
])
const maxMediaSize = 20 * 1024 * 1024
const defaultMediaDirectory = path.resolve(import.meta.dirname, '../data/exercise-media')

function getSessionToken(request) {
  for (const cookie of (request.headers.cookie ?? '').split(';')) {
    const separatorIndex = cookie.indexOf('=')
    if (separatorIndex >= 0 && cookie.slice(0, separatorIndex).trim() === 'feel_flow_session') {
      return cookie.slice(separatorIndex + 1).trim()
    }
  }
  return null
}

function validateWorkout(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const day = typeof body?.day === 'string' ? body.day : ''
  if (name.length < 2 || name.length > 60 || !workoutDays.includes(day)) {
    return { error: 'Ingresá un título y un día válidos para la rutina.' }
  }

  if (!Array.isArray(body.exercises) || body.exercises.length < 1 || body.exercises.length > 30) {
    return { error: 'Agregá entre 1 y 30 ejercicios a la rutina.' }
  }

  const exercises = []
  for (const [index, exercise] of body.exercises.entries()) {
    const exerciseName = typeof exercise?.name === 'string' ? exercise.name.trim() : ''
    if (exerciseName.length < 2 || exerciseName.length > 80) {
      return { error: `Revisá el nombre del ejercicio ${index + 1} (debe tener entre 2 y 80 caracteres).` }
    }
    const id = exercise?.id === undefined ? null : Number(exercise.id)
    if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) {
      return { error: `El ejercicio ${index + 1} no es válido.` }
    }
    exercises.push({ id, name: exerciseName })
  }

  const exerciseIds = exercises.flatMap(({ id }) => id === null ? [] : [id])
  if (new Set(exerciseIds).size !== exerciseIds.length) {
    return { error: 'La rutina contiene ejercicios duplicados.' }
  }

  return { workout: { name, day, exercises } }
}

function mediaUrl(workoutId, exerciseId) {
  return `/api/workouts/${workoutId}/exercises/${exerciseId}/media`
}

function getWorkout(database, userId, workoutId) {
  const workout = database.prepare(`
    SELECT id, day, name, icon, completed_exercises AS completed, total_exercises AS totalExercises
    FROM workouts WHERE id = ? AND user_id = ?
  `).get(workoutId, userId)
  if (!workout) return null

  const exercises = database.prepare(`
    SELECT id, name, is_completed AS completed
    FROM workout_exercises
    WHERE workout_id = ?
    ORDER BY position
  `).all(workoutId).map((exercise) => ({
    ...exercise,
    completed: Boolean(exercise.completed),
  }))

  const mediaByExerciseId = new Map(database.prepare(`
    SELECT exercise_id AS exerciseId, mime_type AS contentType
    FROM exercise_media
    WHERE exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)
  `).all(workoutId).map((media) => [
    media.exerciseId,
    { contentType: media.contentType, url: mediaUrl(workoutId, media.exerciseId) },
  ]))

  for (const exercise of exercises) {
    exercise.media = mediaByExerciseId.get(exercise.id) ?? null
  }

  return { ...workout, exercises }
}

export function createApp(database, {
  secureCookie = false,
  mediaDirectory = defaultMediaDirectory,
} = {}) {
  const app = express()
  const auth = createAuthHandlers(database, { secureCookie })
  mkdirSync(mediaDirectory, { recursive: true })

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
      SELECT id, day, name, icon, completed_exercises AS completed,
        total_exercises AS totalExercises
      FROM workouts WHERE user_id = ? ORDER BY id
    `).all(request.user.id)
    const workoutExercises = database.prepare(`
      SELECT workout_exercises.workout_id AS workoutId, workout_exercises.id,
        workout_exercises.name, workout_exercises.is_completed AS completed
      FROM workout_exercises
      JOIN workouts ON workouts.id = workout_exercises.workout_id
      WHERE workouts.user_id = ?
      ORDER BY workout_exercises.workout_id, workout_exercises.position
    `).all(request.user.id)
    const exerciseMedia = database.prepare(`
      SELECT exercise_media.exercise_id AS exerciseId,
        exercise_media.mime_type AS contentType, workout_exercises.workout_id AS workoutId
      FROM exercise_media
      JOIN workout_exercises ON workout_exercises.id = exercise_media.exercise_id
      JOIN workouts ON workouts.id = workout_exercises.workout_id
      WHERE workouts.user_id = ?
    `).all(request.user.id)
    const mediaByExerciseId = new Map(exerciseMedia.map((media) => [
      media.exerciseId,
      { contentType: media.contentType, url: mediaUrl(media.workoutId, media.exerciseId) },
    ]))
    const exercisesByWorkout = new Map()
    for (const exercise of workoutExercises) {
      const exercises = exercisesByWorkout.get(exercise.workoutId) ?? []
      exercises.push({
        ...exercise,
        completed: Boolean(exercise.completed),
        media: mediaByExerciseId.get(exercise.id) ?? null,
      })
      exercisesByWorkout.set(exercise.workoutId, exercises)
    }
    const detailedWorkouts = workouts.map((workout) => ({
      ...workout,
      exercises: exercisesByWorkout.get(workout.id) ?? [],
    }))
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
      workouts: detailedWorkouts,
      attendance,
      kilogramsLifted: attendance.reduce((sum, item) => sum + item.kilogramsLifted, 0),
    })
  })

  app.post('/api/workouts', requireUser, (request, response) => {
    const validation = validateWorkout(request.body)
    if (validation.error) return response.status(400).json({ error: validation.error })

    const workoutId = database.transaction(() => {
      const result = database.prepare(`
      INSERT INTO workouts (user_id, day, name, icon, completed_exercises, total_exercises)
      VALUES (?, ?, ?, ?, 0, ?)
      `).run(
        request.user.id,
        validation.workout.day,
        validation.workout.name,
        '🏋🏻‍♀️',
        validation.workout.exercises.length,
      )
      const id = Number(result.lastInsertRowid)
      const insertExercise = database.prepare(`
        INSERT INTO workout_exercises (workout_id, position, name) VALUES (?, ?, ?)
      `)
      validation.workout.exercises.forEach((exercise, position) => {
        insertExercise.run(id, position, exercise.name)
      })
      return id
    })()
    const workout = getWorkout(database, request.user.id, workoutId)

    return response.status(201).json({ workout })
  })

  app.put('/api/workouts/:id', requireUser, (request, response) => {
    const workoutId = Number(request.params.id)
    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return response.status(400).json({ error: 'La rutina no es válida.' })
    }
    const validation = validateWorkout(request.body)
    if (validation.error) return response.status(400).json({ error: validation.error })

    let removedMediaFiles = []
    const updateWorkout = database.transaction(() => {
      const currentExercises = database.prepare(`
        SELECT id FROM workout_exercises WHERE workout_id = ?
      `).all(workoutId)
      const currentIds = new Set(currentExercises.map(({ id }) => id))
      const suppliedIds = validation.workout.exercises.flatMap(
        ({ id }) => id === null ? [] : [id],
      )
      if (suppliedIds.some((id) => !currentIds.has(id))) {
        return null
      }

      const result = database.prepare(`
        UPDATE workouts
        SET day = ?, name = ?, completed_exercises = 0, total_exercises = ?
        WHERE id = ? AND user_id = ?
      `).run(
        validation.workout.day,
        validation.workout.name,
        validation.workout.exercises.length,
        workoutId,
        request.user.id,
      )
      if (result.changes === 0) return false

      const retainedIds = new Set(suppliedIds)
      const removedIds = [...currentIds].filter((id) => !retainedIds.has(id))
      if (removedIds.length > 0) {
        removedMediaFiles = database.prepare(`
          SELECT filename FROM exercise_media WHERE exercise_id IN (${removedIds.map(() => '?').join(',')})
        `).all(...removedIds).map(({ filename }) => filename)
        database.prepare(`
          DELETE FROM workout_exercises WHERE id IN (${removedIds.map(() => '?').join(',')})
        `).run(...removedIds)
      }

      database.prepare(`
        UPDATE workout_exercises SET position = position + 100 WHERE workout_id = ?
      `).run(workoutId)
      const updateExercise = database.prepare(`
        UPDATE workout_exercises SET position = ?, name = ?, is_completed = 0
        WHERE id = ? AND workout_id = ?
      `)
      const insertExercise = database.prepare(`
        INSERT INTO workout_exercises (workout_id, position, name) VALUES (?, ?, ?)
      `)
      validation.workout.exercises.forEach((exercise, position) => {
        if (exercise.id === null) insertExercise.run(workoutId, position, exercise.name)
        else updateExercise.run(position, exercise.name, exercise.id, workoutId)
      })
      return true
    })
    const updateResult = updateWorkout()
    if (updateResult === false) return response.status(404).json({ error: 'No encontramos esa rutina.' })
    if (updateResult === null) {
      return response.status(400).json({ error: 'La rutina contiene un ejercicio que no le pertenece.' })
    }
    for (const filename of removedMediaFiles) {
      const filePath = path.join(mediaDirectory, filename)
      if (existsSync(filePath)) unlinkSync(filePath)
    }
    return response.json({ workout: getWorkout(database, request.user.id, workoutId) })
  })

  app.delete('/api/workouts/:id', requireUser, (request, response) => {
    const workoutId = Number(request.params.id)
    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return response.status(400).json({ error: 'La rutina no es válida.' })
    }

    const deleteWorkout = database.transaction(() => {
      const workout = database.prepare(`
        SELECT id FROM workouts WHERE id = ? AND user_id = ?
      `).get(workoutId, request.user.id)
      if (!workout) return null

      const mediaFiles = database.prepare(`
        SELECT exercise_media.filename
        FROM exercise_media
        JOIN workout_exercises ON workout_exercises.id = exercise_media.exercise_id
        WHERE workout_exercises.workout_id = ?
      `).all(workoutId).map(({ filename }) => filename)
      database.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?')
        .run(workoutId, request.user.id)
      return mediaFiles
    })

    const mediaFiles = deleteWorkout()
    if (mediaFiles === null) {
      return response.status(404).json({ error: 'No encontramos esa rutina.' })
    }
    for (const filename of mediaFiles) {
      const filePath = path.join(mediaDirectory, filename)
      if (existsSync(filePath)) unlinkSync(filePath)
    }

    return response.status(204).end()
  })

  app.put(
    '/api/workouts/:workoutId/exercises/:exerciseId/media',
    requireUser,
    express.raw({ type: '*/*', limit: maxMediaSize }),
    (request, response) => {
      const workoutId = Number(request.params.workoutId)
      const exerciseId = Number(request.params.exerciseId)
      if (!Number.isSafeInteger(workoutId) || workoutId <= 0
        || !Number.isSafeInteger(exerciseId) || exerciseId <= 0) {
        return response.status(400).json({ error: 'El ejercicio no es válido.' })
      }

      const ownership = database.prepare(`
        SELECT workout_exercises.id FROM workout_exercises
        JOIN workouts ON workouts.id = workout_exercises.workout_id
        WHERE workouts.id = ? AND workouts.user_id = ? AND workout_exercises.id = ?
      `).get(workoutId, request.user.id, exerciseId)
      if (!ownership) return response.status(404).json({ error: 'No encontramos ese ejercicio.' })

      const contentType = request.headers['content-type']?.split(';')[0].trim().toLowerCase()
      const mediaType = supportedMediaTypes.get(contentType)
      if (!mediaType) {
        return response.status(415).json({ error: 'Usá una imagen JPG, PNG o WebP, o un video MP4 o WebM.' })
      }
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        return response.status(400).json({ error: 'El archivo está vacío.' })
      }
      if (!mediaType.signature(request.body)) {
        return response.status(400).json({ error: 'El contenido del archivo no coincide con su formato.' })
      }

      const filename = `${randomUUID()}.${mediaType.extension}`
      const filePath = path.join(mediaDirectory, filename)
      const oldMedia = database.prepare(`
        SELECT filename FROM exercise_media WHERE exercise_id = ?
      `).get(exerciseId)
      const upsertMedia = database.prepare(`
        INSERT INTO exercise_media (exercise_id, filename, mime_type)
        VALUES (?, ?, ?)
        ON CONFLICT (exercise_id) DO UPDATE
        SET filename = excluded.filename, mime_type = excluded.mime_type,
          created_at = CURRENT_TIMESTAMP
      `)

      try {
        writeFileSync(filePath, request.body, { flag: 'wx' })
        upsertMedia.run(exerciseId, filename, contentType)
      } catch (error) {
        if (existsSync(filePath)) unlinkSync(filePath)
        throw error
      }

      if (oldMedia) {
        const oldFilePath = path.join(mediaDirectory, oldMedia.filename)
        if (existsSync(oldFilePath)) unlinkSync(oldFilePath)
      }
      return response.json({
        media: { contentType, url: mediaUrl(workoutId, exerciseId) },
      })
    },
  )

  app.get(
    '/api/workouts/:workoutId/exercises/:exerciseId/media',
    requireUser,
    (request, response, next) => {
      const media = database.prepare(`
        SELECT exercise_media.filename, exercise_media.mime_type AS contentType
        FROM exercise_media
        JOIN workout_exercises ON workout_exercises.id = exercise_media.exercise_id
        JOIN workouts ON workouts.id = workout_exercises.workout_id
        WHERE workouts.id = ? AND workouts.user_id = ? AND workout_exercises.id = ?
      `).get(Number(request.params.workoutId), request.user.id, Number(request.params.exerciseId))
      if (!media) return response.status(404).json({ error: 'No encontramos ese archivo.' })
      response.setHeader('Cache-Control', 'private, max-age=3600')
      return response.sendFile(path.join(mediaDirectory, media.filename), {
        headers: { 'Content-Type': media.contentType },
      }, (error) => {
        if (error && !response.headersSent) next(error)
      })
    },
  )

  app.delete(
    '/api/workouts/:workoutId/exercises/:exerciseId/media',
    requireUser,
    (request, response) => {
      const exerciseId = Number(request.params.exerciseId)
      const media = database.prepare(`
        SELECT exercise_media.filename
        FROM exercise_media
        JOIN workout_exercises ON workout_exercises.id = exercise_media.exercise_id
        JOIN workouts ON workouts.id = workout_exercises.workout_id
        WHERE workouts.id = ? AND workouts.user_id = ? AND workout_exercises.id = ?
      `).get(Number(request.params.workoutId), request.user.id, exerciseId)
      if (!media) return response.status(404).json({ error: 'No encontramos ese archivo.' })

      database.prepare('DELETE FROM exercise_media WHERE exercise_id = ?').run(exerciseId)
      const filePath = path.join(mediaDirectory, media.filename)
      if (existsSync(filePath)) unlinkSync(filePath)
      return response.status(204).end()
    },
  )

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
        UPDATE workout_exercises SET is_completed = 1 WHERE workout_id = ?
      `).run(workoutId)
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
