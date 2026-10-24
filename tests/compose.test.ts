// The whole backend wired together with a real in-memory database. Only the paid API
// calls (classifier/summary JSON and the streamed reply) are faked.
import { composeApp } from '../src/main/compose';
import { sendMessage } from '../src/main/ipc/sendMessage';
import { upgradeMessage } from '../src/main/ipc/upgradeMessage';
import { openDatabase } from '../src/main/db';
import { MODELS } from '../src/main/router/models';
import type { Complete, StreamReply } from '../src/main/providers/anthropic';

const NOW = 1_700_000_000_000;

function app(o: { difficulty?: string; maxContextTokens?: number } = {}) {
  const calls: string[] = [];
  const complete: Complete = async ({ system }) => {
    if (system.includes('condense')) {
      calls.push('summary');
      return { json: { summary: 'they like tea' }, usage: { inputTokens: 400, outputTokens: 40 } };
    }
    calls.push('classify');
    return { json: { category: 'chat', difficulty: o.difficulty ?? 'easy' }, usage: { inputTokens: 150, outputTokens: 10 } };
  };
  const streamReply: StreamReply = async ({ model, messages, onToken }) => {
    calls.push(`reply:${model}:${messages.length}`);
    onToken('ok');
    return { text: `from ${model}`, usage: { inputTokens: 1000, outputTokens: 500 } };
  };
  const parts = composeApp({
    db: openDatabase(),
    getApiKey: () => 'sk-test',
    complete,
    streamReply,
    now: () => NOW,
    maxContextTokens: o.maxContextTokens,
  });
  const send = (chatId: string, text: string) => sendMessage(parts.chatDeps, { chatId, text, language: 'fr' }, () => {});
  return { ...parts, calls, send };
}

describe('composeApp', () => {
  it('routes, replies, saves the conversation and records usage', async () => {
    const a = app();
    const r = await a.send('c1', 'bonjour');
    expect(r.model).toBe(MODELS.haiku);
    expect(a.messages.getMessages('c1').map((m) => `${m.role}:${m.content}`)).toEqual([
      'user:bonjour',
      `assistant:from ${MODELS.haiku}`,
    ]);
    const stats = a.getWeeklyStats();
    expect(stats.byModel.haiku.calls).toBe(2); // classifier + reply
  });

  it('serves the weekly stats the dashboard asks for', async () => {
    const a = app();
    await a.send('c1', 'bonjour');
    const s = a.logger.list(0, NOW + 1);
    expect(s.length).toBe(2);
    expect(s.every((r) => r.language === 'fr')).toBe(true);
  });

  it('uses the default model and skips the classifier when routing is switched off', async () => {
    const a = app();
    a.config.set({ routing: { enabled: false } });
    const r = await a.send('c1', 'hi');
    expect(r.model).toBe(MODELS.sonnet);
    expect(a.calls.includes('classify')).toBe(false);
  });

  it('upgrades an answer, then learns to route that kind of question higher', async () => {
    const a = app();
    const up = async () => {
      const r = await a.send('c1', 'q');
      return upgradeMessage(a.chatDeps, {
        chatId: 'c1', userMessageId: r.userMessage.id, replyMessageId: r.reply.id,
        fromModel: r.model, category: r.category, difficulty: r.difficulty,
      }, () => {});
    };
    expect((await up()).model).toBe(MODELS.sonnet);
    await up();
    const third = await a.send('c1', 'q');
    expect(third.model).toBe(MODELS.sonnet); // learned from two upgrades
  });

  it('summarizes a long chat, continues in a fresh chat and logs the summary as overhead', async () => {
    const a = app({ maxContextTokens: 10 });
    await a.send('c1', 'a fairly long first message about tea');
    const r = await a.send('c1', 'and a second one');
    expect(r.continuedInChatId).toBeDefined();
    expect(r.continuedInChatId).not.toBe('c1');
    expect(a.calls.some((c) => c === 'summary')).toBe(true);
    const fresh = a.messages.getMessages(r.continuedInChatId!);
    expect(fresh[0].content).toContain('they like tea');
    expect(fresh.map((m) => m.role)).toEqual(['user', 'user', 'assistant']);
    expect(a.logger.list(0, NOW + 1).some((u) => u.kind === 'summary')).toBe(true);
  });

  it('does not summarize when the setting is off', async () => {
    const a = app({ maxContextTokens: 10 });
    a.config.set({ languageSavings: { autoSummarizeLongChats: false } });
    await a.send('c1', 'a fairly long first message about tea');
    const r = await a.send('c1', 'and a second one');
    expect(r.continuedInChatId).toBeUndefined();
  });
});
