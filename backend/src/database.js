import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const defaultDatabasePath = path.resolve(import.meta.dirname, '../data/feel-flow.sqlite')

export function createDatabase(databasePath = defaultDatabasePath) {
  mkdirSync(path.dirname(databasePath), { recursive: true })

  const database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      fitness_json TEXT NOT NULL,
      preferences_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      completed_exercises INTEGER NOT NULL DEFAULT 0 CHECK (completed_exercises >= 0),
      total_exercises INTEGER NOT NULL CHECK (total_exercises > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS workouts_user_id_idx ON workouts(user_id);

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position >= 0),
      name TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
      UNIQUE (workout_id, position)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attended_on TEXT NOT NULL,
      kilograms_lifted REAL NOT NULL DEFAULT 0 CHECK (kilograms_lifted >= 0),
      UNIQUE (user_id, attended_on)
    );
  `)

  migrateWorkoutExercises(database)

  database.exec(`
    CREATE INDEX IF NOT EXISTS workout_exercises_workout_id_idx
      ON workout_exercises(workout_id, position);

    CREATE TABLE IF NOT EXISTS exercise_media (
      exercise_id INTEGER PRIMARY KEY REFERENCES workout_exercises(id) ON DELETE CASCADE,
      filename TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL CHECK (mime_type IN (
        'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'
      )),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  return database
}

function migrateWorkoutExercises(database) {
  const columns = database.pragma('table_info(workout_exercises)')
  if (!columns.some(({ name }) => name === 'sets')) return

  database.transaction(() => {
    database.exec(`
      CREATE TABLE workout_exercises_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position >= 0),
        name TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
        UNIQUE (workout_id, position)
      );

      INSERT INTO workout_exercises_new (id, workout_id, position, name, is_completed)
      SELECT id, workout_id, position, name, is_completed FROM workout_exercises;

      DROP TABLE workout_exercises;
      ALTER TABLE workout_exercises_new RENAME TO workout_exercises;
    `)
  })()
}
