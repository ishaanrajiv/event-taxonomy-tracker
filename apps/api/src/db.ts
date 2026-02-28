import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Database } from 'bun:sqlite';

export interface DatabaseContext {
  db: Database;
  dbPath: string;
}

export function createDatabase(dbPath?: string): DatabaseContext {
  const resolvedPath = resolve(
    dbPath ?? process.env.DB_PATH ?? resolve(import.meta.dir, '..', 'data', 'event_taxonomy.db'),
  );
  mkdirSync(dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath, { create: true, strict: true });
  initDatabase(db);
  return { db, dbPath: resolvedPath };
}

export function initDatabase(db: Database): void {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      data_type TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_properties_name ON properties(name);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      current_version_number INTEGER NOT NULL DEFAULT 0,
      current_version_id INTEGER,
      is_archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      archived_by TEXT,
      lock_version INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
    CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    CREATE INDEX IF NOT EXISTS idx_events_is_archived ON events(is_archived);
    CREATE INDEX IF NOT EXISTS idx_events_current_version_id ON events(current_version_id);

    CREATE TABLE IF NOT EXISTS event_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      property_name TEXT NOT NULL,
      property_type TEXT NOT NULL,
      data_type TEXT NOT NULL,
      description TEXT,
      is_required INTEGER NOT NULL DEFAULT 0,
      example_value TEXT,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(property_id) REFERENCES properties(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_event_live_property_key
      ON event_properties(event_id, property_name, property_type);
    CREATE INDEX IF NOT EXISTS idx_event_properties_event_id ON event_properties(event_id);
    CREATE INDEX IF NOT EXISTS idx_event_properties_property_id ON event_properties(property_id);
    CREATE INDEX IF NOT EXISTS idx_event_properties_name ON event_properties(property_name);

    CREATE TABLE IF NOT EXISTS event_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      parent_version_id INTEGER,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      change_reason TEXT,
      snapshot TEXT NOT NULL,
      diff TEXT NOT NULL,
      checksum TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      reverted_from_version_id INTEGER,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(parent_version_id) REFERENCES event_versions(id),
      FOREIGN KEY(reverted_from_version_id) REFERENCES event_versions(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_event_version_number
      ON event_versions(event_id, version_number);
    CREATE INDEX IF NOT EXISTS idx_event_versions_event_id ON event_versions(event_id);
    CREATE INDEX IF NOT EXISTS idx_event_versions_checksum ON event_versions(checksum);

    CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
      name,
      description,
      category,
      content='events',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
      INSERT INTO events_fts(rowid, name, description, category)
      VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
      INSERT INTO events_fts(events_fts, rowid, name, description, category)
      VALUES ('delete', old.id, old.name, COALESCE(old.description, ''), COALESCE(old.category, ''));
      INSERT INTO events_fts(rowid, name, description, category)
      VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
      INSERT INTO events_fts(events_fts, rowid, name, description, category)
      VALUES ('delete', old.id, old.name, COALESCE(old.description, ''), COALESCE(old.category, ''));
    END;
  `);

  db.exec(`
    INSERT INTO events_fts(rowid, name, description, category)
    SELECT e.id, e.name, COALESCE(e.description, ''), COALESCE(e.category, '')
    FROM events e
    WHERE e.id NOT IN (SELECT rowid FROM events_fts);
  `);
}

export function resetDatabase(db: Database): void {
  db.exec(`
    DROP TRIGGER IF EXISTS events_fts_insert;
    DROP TRIGGER IF EXISTS events_fts_update;
    DROP TRIGGER IF EXISTS events_fts_delete;
    DROP TABLE IF EXISTS event_versions;
    DROP TABLE IF EXISTS event_properties;
    DROP TABLE IF EXISTS properties;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS events_fts;
  `);
  initDatabase(db);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function runInTransaction<T>(db: Database, callback: () => T): T {
  db.exec('BEGIN');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
