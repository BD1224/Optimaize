// SQLite-backed store for the router's learned overrides (see router/feedback.ts).
import type { FeedbackState, FeedbackStore } from '../router/feedback';
import type { Db } from './index';

interface Row {
  key: string;
  upgrade_count: number;
  to_model: string;
}

export function createRoutingMemoryStore(db: Db): FeedbackStore {
  const select = db.prepare('SELECT key, upgrade_count, to_model FROM routing_memory');
  const upsert = db.prepare(
    `INSERT INTO routing_memory (key, upgrade_count, to_model) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET upgrade_count = excluded.upgrade_count, to_model = excluded.to_model`,
  );

  return {
    load() {
      const state: FeedbackState = {};
      for (const r of select.all() as unknown as Row[]) {
        state[r.key] = { count: r.upgrade_count, toModel: r.to_model };
      }
      return state;
    },
    save(state) {
      for (const [key, stat] of Object.entries(state)) upsert.run(key, stat.count, stat.toModel);
    },
  };
}
