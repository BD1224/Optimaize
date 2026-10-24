// SQLite access: chats, messages and the usage log.
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { ChatMessage, Role } from '../../shared/chat';
import type { UsageRecord } from '../../shared/usage';
import { SCHEMA } from './schema';

export type Db = Database.Database;

export function openDb(path: string): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function createChat(db: Db, title: string | null = null, id: string = randomUUID()): string {
  db.prepare('INSERT INTO chats (id, title, created_at) VALUES (?, ?, ?)').run(id, title, Date.now());
  return id;
}

export function chatExists(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM chats WHERE id = ?').get(id) !== undefined;
}

export interface NewMessage {
  chatId: string;
  role: Role;
  content: string;
  model?: string;
  language?: string;
}

export function addMessage(db: Db, m: NewMessage): ChatMessage {
  const message: ChatMessage = {
    id: randomUUID(),
    chatId: m.chatId,
    role: m.role,
    content: m.content,
    createdAt: Date.now(),
  };
  db.prepare(
    'INSERT INTO messages (id, chat_id, role, content, model, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(message.id, message.chatId, message.role, message.content, m.model ?? null, m.language ?? null, message.createdAt);
  return message;
}

// Oldest first, so the result can be sent to the model as-is
export function getMessages(db: Db, chatId: string): ChatMessage[] {
  const rows = db
    .prepare('SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY created_at, rowid')
    .all(chatId) as { id: string; chat_id: string; role: Role; content: string; created_at: number }[];
  return rows.map((r) => ({ id: r.id, chatId: r.chat_id, role: r.role, content: r.content, createdAt: r.created_at }));
}

export function logUsage(db: Db, u: UsageRecord): void {
  db.prepare(
    `INSERT INTO usage_log
       (id, message_id, is_retry, model, language, input_tokens, output_tokens, cost_usd, baseline_cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(u.id, u.messageId, u.isRetry ? 1 : 0, u.model, u.language, u.inputTokens, u.outputTokens, u.costUsd, u.baselineCostUsd, u.createdAt);
}
