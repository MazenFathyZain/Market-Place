import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const filename = process.env.DB_FILE
  ? path.resolve(root, process.env.DB_FILE)
  : path.join(root, 'data/marketplace.sqlite');
fs.mkdirSync(path.dirname(filename), { recursive: true });

export const db = new DatabaseSync(filename);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

export function migrate() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));",
  );
  const dir = path.join(root, 'migrations');
  for (const name of fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(name)) continue;
    db.exec('BEGIN');
    try {
      db.exec(fs.readFileSync(path.join(dir, name), 'utf8'));
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
