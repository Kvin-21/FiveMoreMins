CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  login_token TEXT,
  login_token_expires INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS partner_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_email TEXT NOT NULL,
  invite_token TEXT UNIQUE NOT NULL,
  invited_at INTEGER DEFAULT (strftime('%s', 'now')),
  consented_at INTEGER,
  consent_ip TEXT,
  consent_user_agent TEXT,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at INTEGER DEFAULT (strftime('%s', 'now')),
  ended_at INTEGER,
  focus_duration INTEGER,
  outcome TEXT CHECK(outcome IN ('completed', 'failed', 'abandoned', 'active')),
  away_seconds INTEGER DEFAULT 0,
  penalty_triggered INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS penalty_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT CHECK(type IN ('partner_email', 'self_email', 'social_post')),
  recipient TEXT NOT NULL,
  sent_at INTEGER DEFAULT (strftime('%s', 'now')),
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_session_date TEXT,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
