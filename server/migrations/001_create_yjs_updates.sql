-- Minimal SQL migration for persistent Yjs room updates
CREATE TABLE IF NOT EXISTS yjs_updates (
  id BIGSERIAL PRIMARY KEY,
  room_id VARCHAR(255) NOT NULL,
  update_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_yjs_updates_room_id_id ON yjs_updates (room_id, id ASC);
