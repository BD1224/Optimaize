import { USAGE_SCHEMA } from './schema';
import type { UsageDb, UsageRecord } from './types';

interface Row {
  id: string;
  message_id: string;
  parent_message_id: string | null;
  kind: UsageRecord['kind'];
  model: UsageRecord['model'];
  difficulty: UsageRecord['difficulty'];
  input_tokens: number;
  output_tokens: number;
  is_upgrade: number;
  language: string | null;
  created_at: number;
}

const fromRow = (r: Row): UsageRecord => ({
  id: r.id,
  messageId: r.message_id,
  parentMessageId: r.parent_message_id,
  kind: r.kind,
  model: r.model,
  difficulty: r.difficulty,
  inputTokens: r.input_tokens,
  outputTokens: r.output_tokens,
  isUpgrade: r.is_upgrade === 1,
  language: r.language,
  createdAt: r.created_at,
});

export interface UsageLogger {
  // The one call Person A makes after every API call.
  record(rec: UsageRecord): void;
  // Records with since <= createdAt < until, oldest first.
  list(since: number, until: number): UsageRecord[];
}

export function createUsageLogger(db: UsageDb): UsageLogger {
  db.exec(USAGE_SCHEMA);

  const insert = db.prepare(
    `INSERT INTO usage_log (id, message_id, parent_message_id, kind, model, difficulty,
       input_tokens, output_tokens, is_upgrade, language, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const select = db.prepare(
    'SELECT * FROM usage_log WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC',
  );

  return {
    record(r) {
      for (const n of [r.inputTokens, r.outputTokens]) {
        if (!Number.isInteger(n) || n < 0) {
          throw new Error(`Invalid token count ${n} for usage record ${r.id}`);
        }
      }
      insert.run(
        r.id,
        r.messageId,
        r.parentMessageId,
        r.kind,
        r.model,
        r.difficulty,
        r.inputTokens,
        r.outputTokens,
        r.isUpgrade ? 1 : 0,
        r.language,
        r.createdAt,
      );
    },
    list(since, until) {
      return (select.all(since, until) as Row[]).map(fromRow);
    },
  };
}
