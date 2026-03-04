import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');

// Make sure the data directory exists before opening the DB
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'fivemoremins.db');
const db = new Database(dbPath);

// WAL mode keeps writes fast without blocking reads
db.pragma('journal_mode = WAL');
// Foreign keys are OFF by default in SQLite — turn them on
db.pragma('foreign_keys = ON');

export default db;
