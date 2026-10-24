// Chat message storage. Provides the `db` dependency that sendMessage/upgradeMessage expect.
import { randomUUID } from 'node:crypto';
import type { Category, ChatMessage, MessageMeta, Role } from '../../shared/chat';
import type { Db } from './index';

interface Row {
  id: string;
  chat_id: string;
  role: Role;
  content: string;
  created_at: number;
  language: string | null;
  reply_to: string | null;
  category: Category | null;
  files: string | null;
}

// A stored message with everything the UI needs beyond the plain ChatMessage
export interface StoredMessage extends ChatMessage {
  language: string | null;
  replyTo: string | null;
  category: Category | null;
  files: { name: string; type: string; size: number }[] | null;
}

const toStored = (r: Row): StoredMessage => ({
  id: r.id,
  chatId: r.chat_id,
  role: r.role,
  content: r.content,
  createdAt: r.created_at,
  language: r.language,
  replyTo: r.reply_to,
  category: r.category,
  files: r.files ? (JSON.parse(r.files) as StoredMessage['files']) : null,
});

export function createMessageStore(db: Db, now: () => number = Date.now) {
  const insert = db.prepare(
    `INSERT INTO messages (id, chat_id, role, content, created_at, language, reply_to, category, files)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectChat = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC');
  const selectOne = db.prepare('SELECT * FROM messages WHERE id = ?');
  const deleteOne = db.prepare('DELETE FROM messages WHERE id = ?');
  const deleteChat = db.prepare('DELETE FROM messages WHERE chat_id = ?');

  const plain = (m: StoredMessage): ChatMessage => ({
    id: m.id, chatId: m.chatId, role: m.role, content: m.content, createdAt: m.createdAt,
  });

  return {
    saveMessage(chatId: string, role: Role, content: string, meta: MessageMeta = {}): ChatMessage {
      const message: ChatMessage = { id: randomUUID(), chatId, role, content, createdAt: now() };
      insert.run(
        message.id, chatId, role, content, message.createdAt,
        meta.language ?? null, meta.replyTo ?? null, meta.category ?? null,
        meta.files && meta.files.length > 0 ? JSON.stringify(meta.files) : null,
      );
      return message;
    },
    getMessages(chatId: string): ChatMessage[] {
      return this.getStored(chatId).map(plain);
    },
    getStored(chatId: string): StoredMessage[] {
      return (selectChat.all(chatId) as unknown as Row[]).map(toStored);
    },
    getMessage(id: string): StoredMessage | null {
      const row = selectOne.get(id) as unknown as Row | undefined;
      return row ? toStored(row) : null;
    },
    deleteMessage(id: string): void {
      deleteOne.run(id);
    },
    deleteChatMessages(chatId: string): void {
      deleteChat.run(chatId);
    },
  };
}
