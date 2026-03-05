import Database from 'better-sqlite3';
import path from 'path';

// Database file goes in the backend directory, auto-creates if not there
const DB_PATH = path.join(__dirname, '..', 'fivemoremins.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance (especially with concurrent reads)
db.pragma('journal_mode = WAL');

// Auto-create all tables on startup - zero manual migration needed
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      partner_email TEXT,
      image_path TEXT,
      session_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration_seconds INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      longest_away_seconds INTEGER DEFAULT 0,
      penalty_triggered BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS partner_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      partner_email TEXT NOT NULL,
      consent_token TEXT UNIQUE,
      consented_at DATETIME,
      revoked_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_session_date DATE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  console.log('📦 Database ready (tables created if they didn\'t exist)');
}

initDb();

export default db;
