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

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attended_on TEXT NOT NULL,
      kilograms_lifted REAL NOT NULL DEFAULT 0 CHECK (kilograms_lifted >= 0),
      UNIQUE (user_id, attended_on)
    );
  `)

  return database
}
