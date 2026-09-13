ALTER TABLE episodes ADD COLUMN deleted_at INTEGER;
CREATE INDEX episodes_space ON episodes(owner_id, public, deleted_at, created_at, id);
