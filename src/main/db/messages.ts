// Chat message storage. Provides the `db` dependency that sendMessage/upgradeMessage expect.
import { randomUUID } from 'node:crypto';
import type { ChatMessage, Role } from '../../shared/chat';
import type { Db } from './index';

interface Row {
  id: string;
  chat_id: string;
  role: Role;
  content: string;
  created_at: number;
}

export function createMessageStore(db: Db, now: () => number = Date.now) {
  const insert = db.prepare(
    'INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const select = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC, rowid ASC');

  return {
    saveMessage(chatId: string, role: Role, content: string): ChatMessage {
      const message: ChatMessage = { id: randomUUID(), chatId, role, content, createdAt: now() };
      insert.run(message.id, chatId, role, content, message.createdAt);
      return message;
    },
    getMessages(chatId: string): ChatMessage[] {
      return (select.all(chatId) as unknown as Row[]).map((r) => ({
        id: r.id,
        chatId: r.chat_id,
        role: r.role,
        content: r.content,
        createdAt: r.created_at,
      }));
    },
  };
}
