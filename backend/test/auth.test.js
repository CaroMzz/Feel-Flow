import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { createApp } from '../src/app.js'
import { createDatabase } from '../src/database.js'

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'feel-flow-test-'))
const database = createDatabase(path.join(temporaryDirectory, 'test.sqlite'))
const server = createApp(database, {
  mediaDirectory: path.join(temporaryDirectory, 'exercise-media'),
}).listen(0, '127.0.0.1')
let baseUrl

before(async () => {
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  database.close()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

async function request(pathname, { cookie, ...options } = {}) {
  const headers = new Headers(options.headers)
  if (cookie) headers.set('cookie', cookie)
  return fetch(`${baseUrl}${pathname}`, { ...options, headers })
}

async function createAccount(email = 'caro@example.com') {
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Carolina Test',
      email,
      password: 'secure-password-123',
      fitness: { experience: 2, days: 3, goals: ['Fuerza'], focus: 'full' },
      preferences: { units: 'kg', language: 'Español', workoutReminders: true },
    }),
  })
  return response
}

test('registers a user with an empty workout list and persists the profile', async () => {
  const response = await createAccount()
  assert.equal(response.status, 201)
  const { user } = await response.json()
  assert.equal(user.name, 'Carolina Test')
  assert.equal(user.email, 'caro@example.com')
  assert.equal(user.fitness.goals[0], 'Fuerza')
  assert.equal(user.preferences.units, 'kg')

  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
  assert.doesNotMatch(JSON.stringify(user), /password/i)

  const dashboardResponse = await request('/api/dashboard?year=2026&month=11', { cookie })
  assert.equal(dashboardResponse.status, 200)
  const dashboard = await dashboardResponse.json()
  assert.equal(dashboard.workouts.length, 0)
  assert.equal(dashboard.attendance.length, 0)
})

test('rejects duplicate accounts and invalid registration data', async () => {
  const duplicate = await createAccount('CARO@example.com')
  assert.equal(duplicate.status, 409)

  const invalid = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'C', email: 'not-an-email', password: 'short' }),
  })
  assert.equal(invalid.status, 400)
})

test('authenticates, persists workout changes, completes a routine, and logs out', async () => {
  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'CARO@example.com',
      password: 'secure-password-123',
      remember: true,
    }),
  })
  assert.equal(loginResponse.status, 200)
  const cookie = loginResponse.headers.get('set-cookie')
  assert.match(cookie, /Max-Age=2592000/)

  const createWorkoutResponse = await request('/api/workouts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Fuerza y movilidad',
      day: 'Lunes',
      exercises: [
        { name: 'Sentadilla' },
        { name: 'Plancha' },
      ],
    }),
    cookie,
  })
  assert.equal(createWorkoutResponse.status, 201)
  const { workout: createdWorkout } = await createWorkoutResponse.json()
  assert.equal(createdWorkout.name, 'Fuerza y movilidad')
  assert.equal(createdWorkout.totalExercises, 2)
  assert.deepEqual(
    createdWorkout.exercises.map(({ name, media }) => ({ name, media })),
    [
      { name: 'Sentadilla', media: null },
      { name: 'Plancha', media: null },
    ],
  )

  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const uploadResponse = await request(
    `/api/workouts/${createdWorkout.id}/exercises/${createdWorkout.exercises[0].id}/media`,
    {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: png,
      cookie,
    },
  )
  assert.equal(uploadResponse.status, 200)

  const mediaResponse = await request(
    `/api/workouts/${createdWorkout.id}/exercises/${createdWorkout.exercises[0].id}/media`,
    { cookie },
  )
  assert.equal(mediaResponse.status, 200)
  assert.equal(mediaResponse.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()), png)

  const mp4Header = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])
  const videoUploadResponse = await request(
    `/api/workouts/${createdWorkout.id}/exercises/${createdWorkout.exercises[1].id}/media`,
    {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: mp4Header,
      cookie,
    },
  )
  assert.equal(videoUploadResponse.status, 200)

  const updateWorkoutResponse = await request(`/api/workouts/${createdWorkout.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Fuerza y movilidad en casa',
      day: 'Miércoles',
      exercises: [
        { id: createdWorkout.exercises[1].id, name: 'Flexiones' },
        { id: createdWorkout.exercises[0].id, name: 'Sentadilla' },
      ],
    }),
    cookie,
  })
  assert.equal(updateWorkoutResponse.status, 200)
  const { workout: updatedWorkout } = await updateWorkoutResponse.json()
  assert.equal(updatedWorkout.name, 'Fuerza y movilidad en casa')
  assert.equal(updatedWorkout.day, 'Miércoles')
  assert.equal(updatedWorkout.completed, 0)
  assert.equal(updatedWorkout.totalExercises, 2)
  assert.equal(updatedWorkout.exercises[0].name, 'Flexiones')
  assert.equal(updatedWorkout.exercises[0].media.contentType, 'video/mp4')
  assert.equal(updatedWorkout.exercises[1].media.contentType, 'image/png')

  const invalidMediaResponse = await request(
    `/api/workouts/${createdWorkout.id}/exercises/${createdWorkout.exercises[0].id}/media`,
    {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'not an image',
      cookie,
    },
  )
  assert.equal(invalidMediaResponse.status, 415)

  const dashboardResponse = await request('/api/dashboard?year=2026&month=11', { cookie })
  const { workouts } = await dashboardResponse.json()
  const firstWorkout = workouts[0]

  const completeResponse = await request(`/api/workouts/${firstWorkout.id}/complete`, {
    method: 'POST',
    cookie,
  })
  assert.equal(completeResponse.status, 200)

  const updatedDashboard = await request('/api/dashboard?year=2026&month=11', { cookie })
  const updated = await updatedDashboard.json()
  assert.equal(updated.workouts[0].completed, updated.workouts[0].totalExercises)
  assert.equal(updated.workouts[0].exercises[0].completed, true)
  assert.equal(updated.attendance.length, 1)

  const deleteWorkoutResponse = await request(`/api/workouts/${createdWorkout.id}`, {
    method: 'DELETE',
    cookie,
  })
  assert.equal(deleteWorkoutResponse.status, 204)

  const deletedMediaResponse = await request(
    `/api/workouts/${createdWorkout.id}/exercises/${createdWorkout.exercises[0].id}/media`,
    { cookie },
  )
  assert.equal(deletedMediaResponse.status, 404)

  const dashboardAfterDelete = await request('/api/dashboard?year=2026&month=11', { cookie })
  assert.deepEqual((await dashboardAfterDelete.json()).workouts, [])

  const deleteAgainResponse = await request(`/api/workouts/${createdWorkout.id}`, {
    method: 'DELETE',
    cookie,
  })
  assert.equal(deleteAgainResponse.status, 404)

  const logoutResponse = await request('/api/auth/logout', { method: 'POST', cookie })
  assert.equal(logoutResponse.status, 204)
  const sessionResponse = await request('/api/auth/me', { cookie })
  assert.equal(sessionResponse.status, 401)
})

test('requires a valid session for dashboard and workout endpoints', async () => {
  const response = await request('/api/dashboard?year=2026&month=11')
  assert.equal(response.status, 401)

  const createWorkoutResponse = await request('/api/workouts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Rutina nueva', day: 'Lunes' }),
  })
  assert.equal(createWorkoutResponse.status, 401)

  const deleteWorkoutResponse = await request('/api/workouts/1', { method: 'DELETE' })
  assert.equal(deleteWorkoutResponse.status, 401)
})

test('validates routine name and training day when creating a workout', async () => {
  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'caro@example.com', password: 'secure-password-123' }),
  })
  const cookie = loginResponse.headers.get('set-cookie')
  const response = await request('/api/workouts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'X',
      day: 'Funday',
      exercises: [{ name: 'Sentadilla', sets: 3, reps: 10 }],
    }),
    cookie,
  })
  assert.equal(response.status, 400)

  const invalidExercise = await request('/api/workouts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Rutina inválida',
      day: 'Lunes',
      exercises: [{ name: 'A' }],
    }),
    cookie,
  })
  assert.equal(invalidExercise.status, 400)
})
