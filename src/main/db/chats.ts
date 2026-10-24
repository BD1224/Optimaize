// Chat list storage: title, pin state and last activity.
import { randomUUID } from 'node:crypto';
import type { Db } from './index';

export interface ChatRow {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: number;
}

interface Row {
  id: string;
  title: string;
  pinned: number;
  updated_at: number;
}

const toChat = (r: Row): ChatRow => ({ id: r.id, title: r.title, pinned: r.pinned === 1, updatedAt: r.updated_at });

export function createChatStore(db: Db, now: () => number = Date.now) {
  const insert = db.prepare('INSERT INTO chats (id, title, pinned, updated_at) VALUES (?, ?, 0, ?)');
  const selectOne = db.prepare('SELECT * FROM chats WHERE id = ?');
  const selectAll = db.prepare('SELECT * FROM chats ORDER BY updated_at DESC');
  const touch = db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?');
  const setTitle = db.prepare('UPDATE chats SET title = ? WHERE id = ?');
  const setPinned = db.prepare('UPDATE chats SET pinned = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM chats WHERE id = ?');

  return {
    create(title: string, id: string = randomUUID()): ChatRow {
      insert.run(id, title, now());
      return this.get(id)!;
    },
    get(id: string): ChatRow | null {
      const row = selectOne.get(id) as unknown as Row | undefined;
      return row ? toChat(row) : null;
    },
    list(): ChatRow[] {
      return (selectAll.all() as unknown as Row[]).map(toChat);
    },
    touch(id: string): void {
      touch.run(now(), id);
    },
    update(id: string, patch: { title?: string; pinned?: boolean }): void {
      if (patch.title !== undefined) setTitle.run(patch.title, id);
      if (patch.pinned !== undefined) setPinned.run(patch.pinned ? 1 : 0, id);
    },
    remove(id: string): void {
      remove.run(id);
    },
  };
}
