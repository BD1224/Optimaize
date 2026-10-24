import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '../src/main/db';
import { createMessageStore } from '../src/main/db/messages';
import { createRoutingMemoryStore } from '../src/main/db/routingMemory';
import { createFeedback } from '../src/main/router/feedback';
import { MODELS } from '../src/main/router/models';

describe('openDatabase', () => {
  it('creates the tables from schema.sql, and can be opened twice', () => {
    const db = openDatabase(':memory:');
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(['messages', 'usage_log', 'routing_memory']));
  });
});

describe('message store', () => {
  it('saves and reads messages for a chat in order, isolated per chat', () => {
    let t = 0;
    const store = createMessageStore(openDatabase(), () => ++t);
    const a = store.saveMessage('c1', 'user', 'hi');
    store.saveMessage('c2', 'user', 'other chat');
    store.saveMessage('c1', 'assistant', 'hello');
    const msgs = store.getMessages('c1');
    expect(msgs.map((m) => m.content)).toEqual(['hi', 'hello']);
    expect(msgs[0]).toEqual(a);
    expect(msgs[0].id === msgs[1].id).toBe(false);
  });
});

describe('persistence across restarts', () => {
  it('keeps messages and learned routing after the database is reopened', () => {
    const dir = mkdtempSync(join(__dirname, '.tmp-'));
    const file = join(dir, 'app.sqlite');
    try {
      const first = openDatabase(file);
      createMessageStore(first).saveMessage('c1', 'user', 'remember me');
      const fb = createFeedback(createRoutingMemoryStore(first));
      const up = { category: 'code', difficulty: 'medium', toModel: MODELS.opus } as const;
      fb.recordUpgrade(up);
      fb.recordUpgrade(up);
      first.close();

      const second = openDatabase(file);
      expect(createMessageStore(second).getMessages('c1').map((m) => m.content)).toEqual(['remember me']);
      expect(createFeedback(createRoutingMemoryStore(second)).getOverrides()).toEqual({ 'code:medium': MODELS.opus });
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
