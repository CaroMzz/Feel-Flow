import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { createApp } from '../src/app.js'
import { createDatabase } from '../src/database.js'

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'feel-flow-test-'))
const database = createDatabase(path.join(temporaryDirectory, 'test.sqlite'))
const server = createApp(database).listen(0, '127.0.0.1')
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
    body: JSON.stringify({ name: 'Fuerza y movilidad', day: 'Lunes' }),
    cookie,
  })
  assert.equal(createWorkoutResponse.status, 201)
  const { workout: createdWorkout } = await createWorkoutResponse.json()
  assert.equal(createdWorkout.name, 'Fuerza y movilidad')

  const dashboardResponse = await request('/api/dashboard?year=2026&month=11', { cookie })
  const { workouts } = await dashboardResponse.json()
  const firstWorkout = workouts[0]

  const addExerciseResponse = await request(`/api/workouts/${firstWorkout.id}/exercises`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    cookie,
  })
  assert.equal(addExerciseResponse.status, 201)
  assert.equal((await addExerciseResponse.json()).workout.exercises, firstWorkout.exercises + 1)

  const completeResponse = await request(`/api/workouts/${firstWorkout.id}/complete`, {
    method: 'POST',
    cookie,
  })
  assert.equal(completeResponse.status, 200)

  const updatedDashboard = await request('/api/dashboard?year=2026&month=11', { cookie })
  const updated = await updatedDashboard.json()
  assert.equal(updated.workouts[0].completed, updated.workouts[0].exercises)
  assert.equal(updated.attendance.length, 1)

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
    body: JSON.stringify({ name: 'X', day: 'Funday' }),
    cookie,
  })
  assert.equal(response.status, 400)
})
