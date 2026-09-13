CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 0 CHECK(public IN (0,1)),
  metadata TEXT NOT NULL,
  analysis_key TEXT,
  workflow_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX episodes_owner ON episodes(owner_id, created_at);
CREATE TABLE checkpoints (
  owner_id TEXT NOT NULL,
  episode_id TEXT NOT NULL REFERENCES episodes(id),
  value TEXT NOT NULL,
  PRIMARY KEY(owner_id, episode_id)
);
CREATE TABLE voice_usage (
  session_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  episode_id TEXT NOT NULL REFERENCES episodes(id),
  seconds REAL NOT NULL DEFAULT 0,
  finalized INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE budgets (
  bucket TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  title TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
);
