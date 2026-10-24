// Person B's table. At integration, copy this SQL into src/main/db/schema.sql.
export const USAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  parent_message_id TEXT,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  difficulty TEXT,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  is_upgrade INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at);
`;
