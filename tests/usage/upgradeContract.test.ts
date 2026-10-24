// End to end: real sendMessage + upgradeMessage + feedback + router policy + usage logging.
import { sendMessage, type SendMessageDeps } from '../../src/main/ipc/sendMessage';
import { AlreadyAtTopModelError, upgradeMessage, type UpgradeMessageDeps } from '../../src/main/ipc/upgradeMessage';
import { createFeedback } from '../../src/main/router/feedback';
import { MODELS } from '../../src/main/router/models';
import { pickModel } from '../../src/main/router/policy';
import { createUsageDep } from '../../src/main/usage/adapter';
import { createUsageLogger } from '../../src/main/usage/logger';
import { cost } from '../../src/main/usage/pricing';
import { weeklyStats } from '../../src/main/usage/weekly';
import type { ChatMessage } from '../../src/shared/chat';
import { openMemoryDb } from './memdb';

const NOW = 1_000_000_000_000;

function setup() {
  const logger = createUsageLogger(openMemoryDb());
  const feedback = createFeedback();
  const history: ChatMessage[] = [];
  let n = 0;
  const saveMessage = (chatId: string, role: 'user' | 'assistant', content: string) => {
    const m: ChatMessage = { id: `m${++n}`, chatId, role, content, createdAt: NOW };
    history.push(m);
    return m;
  };
  const usage = createUsageDep(logger, { now: () => NOW, onError: (e) => { throw e; } });
  const seenMessages: string[][] = [];
  const providers = {
    streamReply: async ({ model, messages, onToken }: { model: string; messages: ChatMessage[]; onToken: (d: string) => void }) => {
      seenMessages.push(messages.map((m) => m.id));
      onToken(model);
      return { text: `answer from ${model}`, usage: { inputTokens: 1000, outputTokens: model === MODELS.sonnet ? 800 : 500 } };
    },
  };
  const context = { prepare: async (chatId: string) => ({ chatId, messages: [...history], rolledOver: false }) };
  const sendDeps: SendMessageDeps = {
    db: { saveMessage },
    context,
    router: {
      route: async () => ({
        model: pickModel('chat', 'easy', feedback.getOverrides()),
        category: 'chat',
        difficulty: 'easy',
        classifier: { model: MODELS.haiku, usage: { inputTokens: 150, outputTokens: 10 } },
      }),
    },
    providers,
    usage,
  };
  const upDeps: UpgradeMessageDeps = { db: { saveMessage }, context, providers, usage, feedback };
  const send = () => sendMessage(sendDeps, { chatId: 'c1', text: 'hi', language: 'fr' }, () => {});
  const upgrade = (r: Awaited<ReturnType<typeof send>>) =>
    upgradeMessage(upDeps, {
      chatId: 'c1', userMessageId: r.userMessage.id, replyMessageId: r.reply.id,
      fromModel: r.model, category: r.category, difficulty: r.difficulty, language: 'fr',
    }, () => {});
  return { logger, feedback, history, seenMessages, send, upgrade };
}

describe('Upgrade flow', () => {
  it('re-runs on the next model and returns a new reply', async () => {
    const t = setup();
    const first = await t.send();
    const up = await t.upgrade(first);
    expect(first.model).toBe(MODELS.haiku);
    expect(up.model).toBe(MODELS.sonnet);
    expect(up.reply.content).toBe(`answer from ${MODELS.sonnet}`);
    expect(up.costUsd).toBeCloseTo(cost('sonnet', 1000, 800), 12);
  });

  it('does not send the answer being replaced back to the model', async () => {
    const t = setup();
    const first = await t.send();
    await t.upgrade(first);
    const upgradeCall = t.seenMessages[1];
    expect(upgradeCall.includes(first.userMessage.id)).toBe(true);
    expect(upgradeCall.includes(first.reply.id)).toBe(false);
  });

  it('saves the new reply alongside the history', async () => {
    const t = setup();
    const first = await t.send();
    const before = t.history.length;
    await t.upgrade(first);
    expect(t.history.length).toBe(before + 1);
  });

  it('logs the upgrade under the original exchange and counts the wasted first attempt', async () => {
    const t = setup();
    const first = await t.send();
    await t.upgrade(first);
    const rows = t.logger.list(0, NOW + 1);
    const upRow = rows.find((r) => r.isUpgrade)!;
    expect(upRow.parentMessageId).toBe(first.userMessage.id);
    expect(upRow.model).toBe('sonnet');
    expect(rows.every((r) => r.language === 'fr')).toBe(true);

    const s = weeklyStats(rows, NOW + 1);
    expect(s.upgradeCount).toBe(1);
    expect(s.baselineCost).toBeCloseTo(cost('opus', 1000, 800), 12); // final answer, once
    expect(s.upgradeCost).toBeCloseTo(cost('sonnet', 1000, 800), 12);
  });

  it('refuses to upgrade past the most capable model', async () => {
    const t = setup();
    const first = await t.send();
    await expect(t.upgrade({ ...first, model: MODELS.opus })).rejects.toBeInstanceOf(AlreadyAtTopModelError);
  });

  it('after repeated upgrades the router sends that kind of question to a bigger model', async () => {
    const t = setup();
    const a = await t.send();
    await t.upgrade(a);
    const b = await t.send();
    expect(b.model).toBe(MODELS.haiku); // one upgrade is not enough
    await t.upgrade(b);
    const c = await t.send();
    expect(c.model).toBe(MODELS.sonnet); // learned
  });
});
