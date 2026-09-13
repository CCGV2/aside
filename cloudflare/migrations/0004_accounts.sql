CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  alias TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  avatar_key TEXT,
  google_picture TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE auth_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY(provider, subject)
);
CREATE INDEX auth_identities_user ON auth_identities(user_id);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires INTEGER NOT NULL
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent INTEGER NOT NULL
);
CREATE TABLE auth_oauth_states (
  state_hash TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  link_user_id TEXT,
  expires INTEGER NOT NULL
);
