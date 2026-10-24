// Contract test: Person A's real sendMessage() + the real adapter, logger and SQLite.
// Only the DB/context/router/provider dependencies are fakes.
import { sendMessage, type SendMessageDeps } from '../../src/main/ipc/sendMessage';
import { createUsageDep } from '../../src/main/usage/adapter';
import { createUsageLogger } from '../../src/main/usage/logger';
import { cost } from '../../src/main/usage/pricing';
import { weeklyStats } from '../../src/main/usage/weekly';
import type { ChatMessage, Difficulty } from '../../src/shared/chat';
import { openMemoryDb } from './memdb';

const NOW = 1_000_000_000_000;
const HAIKU = 'claude-haiku-5-5';
const SONNET = 'claude-sonnet-5-5';

function setup(o: {
  model?: string;
  difficulty?: Difficulty;
  classifierUsage?: { inputTokens: number; outputTokens: number };
  onError?: (e: unknown) => void;
} = {}) {
  const logger = createUsageLogger(openMemoryDb());
  let n = 0;
  const msg = (chatId: string, role: 'user' | 'assistant', content: string): ChatMessage => ({
    id: `m${++n}`, chatId, role, content, createdAt: NOW,
  });
  const deps: SendMessageDeps = {
    db: { saveMessage: (chatId, role, content) => msg(chatId, role, content) },
    context: { prepare: async (chatId) => ({ chatId, messages: [], rolledOver: false }) },
    router: {
      route: async () => ({
        model: o.model ?? HAIKU,
        category: 'chat',
        difficulty: o.difficulty ?? 'easy',
        classifier: { model: HAIKU, usage: o.classifierUsage ?? { inputTokens: 150, outputTokens: 10 } },
      }),
    },
    providers: {
      streamReply: async ({ onToken }) => {
        onToken('hi');
        return { text: 'hi', usage: { inputTokens: 1000, outputTokens: 500 } };
      },
    },
    usage: createUsageDep(logger, { now: () => NOW, onError: o.onError ?? (() => {}) }),
  };
  const send = (text = 'hello') => sendMessage(deps, { chatId: 'c1', text }, () => {});
  return { logger, send };
}

describe('sendMessage + usage logging', () => {
  it('logs a classifier row and a chat row for one routed message', async () => {
    const { logger, send } = setup();
    await send();
    const rows = logger.list(0, NOW + 1);
    expect(rows.map((r) => r.kind).sort()).toEqual(['chat', 'classifier']);
    const chat = rows.find((r) => r.kind === 'chat')!;
    expect(chat.model).toBe('haiku');
    expect(chat.inputTokens).toBe(1000);
    expect(chat.outputTokens).toBe(500);
    expect(chat.difficulty).toBe('easy');
    expect(chat.isUpgrade).toBe(false);
  });

  it('returns costUsd equal to classifier plus reply cost', async () => {
    const { send } = setup();
    const result = await send();
    expect(result.costUsd).toBeCloseTo(cost('haiku', 150, 10) + cost('haiku', 1000, 500), 12);
  });

  it('skips the classifier row when the classifier did not run', async () => {
    const { logger, send } = setup({ classifierUsage: { inputTokens: 0, outputTokens: 0 } });
    await send();
    expect(logger.list(0, NOW + 1).map((r) => r.kind)).toEqual(['chat']);
  });

  it('weekly stats show a saving for a cheap model and charge the classifier', async () => {
    const { logger, send } = setup();
    await send();
    const s = weeklyStats(logger.list(0, NOW + 1), NOW + 1);
    expect(s.calls).toBe(2);
    expect(s.netSaved).toBeGreaterThan(0);
    expect(s.overheadCost).toBeGreaterThan(0);
    expect(s.byModel.haiku.calls).toBe(2);
  });

  it('keeps two messages in one chat as two separate baselines', async () => {
    const { logger, send } = setup();
    await send('one');
    await send('two');
    const s = weeklyStats(logger.list(0, NOW + 1), NOW + 1);
    expect(s.baselineCost).toBeCloseTo(2 * cost('opus', 1000, 500), 12);
  });

  it('saves nothing when routed to the biggest model', async () => {
    const { logger, send } = setup({ model: 'claude-opus-5-5', difficulty: 'hard' });
    await send();
    const s = weeklyStats(logger.list(0, NOW + 1), NOW + 1);
    expect(s.netSaved).toBeLessThan(0); // only the classifier overhead is lost
  });

  it('does not break the reply when the model id is unknown', async () => {
    const errors: unknown[] = [];
    const { logger, send } = setup({ model: 'claude-mystery-9', onError: (e) => errors.push(e) });
    const result = await send();
    expect(result.reply.content).toBe('hi');
    expect(errors.length).toBe(1);
    expect(logger.list(0, NOW + 1).map((r) => r.kind)).toEqual(['classifier']);
  });

  it('maps a sonnet model id to the sonnet tier', async () => {
    const { logger, send } = setup({ model: SONNET, difficulty: 'medium' });
    await send();
    expect(logger.list(0, NOW + 1).find((r) => r.kind === 'chat')!.model).toBe('sonnet');
  });
});
