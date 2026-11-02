import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { createDatabase } from '../src/database.js'

test('migrates existing exercise prescriptions to routine templates without data loss', () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'feel-flow-migration-'))
  const databasePath = path.join(temporaryDirectory, 'legacy.sqlite')
  const legacyDatabase = new Database(databasePath)

  legacyDatabase.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    CREATE TABLE workouts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      completed_exercises INTEGER NOT NULL,
      total_exercises INTEGER NOT NULL
    );
    CREATE TABLE workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight_kg REAL,
      rest_seconds INTEGER,
      is_completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE (workout_id, position)
    );
    INSERT INTO users (id) VALUES (1);
    INSERT INTO workouts VALUES (1, 1, 'Lunes', 'Fuerza', '🏋🏻‍♀️', 0, 1);
    INSERT INTO workout_exercises (id, workout_id, position, name, sets, reps, weight_kg, rest_seconds)
    VALUES (7, 1, 0, 'Sentadilla', 4, 8, 20, 90);
  `)
  legacyDatabase.close()

  const database = createDatabase(databasePath)
  const exercise = database.prepare('SELECT id, workout_id, position, name FROM workout_exercises').get()
  const columns = database.pragma('table_info(workout_exercises)').map(({ name }) => name)

  assert.deepEqual(exercise, { id: 7, workout_id: 1, position: 0, name: 'Sentadilla' })
  assert.equal(columns.includes('sets'), false)
  assert.equal(columns.includes('reps'), false)
  assert.equal(columns.includes('weight_kg'), false)
  assert.equal(columns.includes('rest_seconds'), false)
  assert.ok(database.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'exercise_media'
  `).get())

  database.close()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})
