-- Database schema. Run by openDatabase() at startup; every statement is idempotent.

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  language TEXT,
  -- Assistant messages: the user message this answers (ties it to its usage_log rows)
  reply_to TEXT,
  category TEXT,
  -- User messages: JSON list of attached file names, types and sizes
  files TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

-- One row per API call (answers, classifier and summary calls). See src/main/usage/.
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

-- What Upgrade clicks taught the router. key is "category:difficulty".
CREATE TABLE IF NOT EXISTS routing_memory (
  key TEXT PRIMARY KEY,
  upgrade_count INTEGER NOT NULL,
  to_model TEXT NOT NULL
);

-- App settings as JSON, keyed by name (e.g. "config").
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
