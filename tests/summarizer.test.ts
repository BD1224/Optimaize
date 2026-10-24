import { createContext, estimateTokens } from '../src/main/context/summarizer';
import { openDatabase } from '../src/main/db';
import { createMessageStore } from '../src/main/db/messages';
import type { Complete } from '../src/main/providers/anthropic';

const usage = { inputTokens: 100, outputTokens: 20 };

function setup(complete: Complete, maxTokens = 10, enabled = true) {
  const messages = createMessageStore(openDatabase());
  const logged: unknown[] = [];
  const ctx = createContext({
    messages, complete, maxTokens, isEnabled: () => enabled,
    onSummaryUsage: (c) => logged.push(c), newChatId: () => 'fresh',
  });
  return { messages, ctx, logged };
}

describe('context', () => {
  it('estimates 1 token per 3 characters', () => {
    expect(estimateTokens([{ id: '1', chatId: 'c', role: 'user', content: 'abcdef', createdAt: 0 }])).toBe(2);
  });

  it('returns a short chat unchanged', async () => {
    const complete = jest.fn();
    const { messages, ctx } = setup(complete, 1000);
    messages.saveMessage('c1', 'user', 'hi');
    const r = await ctx.prepare('c1');
    expect(r.rolledOver).toBe(false);
    expect(r.chatId).toBe('c1');
    expect(complete).not.toHaveBeenCalled();
  });

  it('summarizes a long chat, seeds a fresh chat and carries the latest message over', async () => {
    const complete = jest.fn().mockResolvedValue({ json: { summary: 'S' }, usage });
    const { messages, ctx, logged } = setup(complete);
    messages.saveMessage('c1', 'user', 'a long opening message');
    messages.saveMessage('c1', 'assistant', 'a long answer to it');
    messages.saveMessage('c1', 'user', 'newest question');
    const r = await ctx.prepare('c1');
    expect(r.rolledOver).toBe(true);
    expect(r.chatId).toBe('fresh');
    expect(r.messages.map((m) => m.content)).toEqual(['Summary of our conversation so far:\nS', 'newest question']);
    expect(logged).toEqual([{ model: 'claude-haiku-5-5', usage }]);
    expect(complete.mock.calls[0][0].user).not.toContain('newest question');
  });

  it('falls back to the full history if the summary fails', async () => {
    const { messages, ctx } = setup(jest.fn().mockRejectedValue(new Error('boom')));
    messages.saveMessage('c1', 'user', 'a long opening message');
    messages.saveMessage('c1', 'user', 'a second long message');
    const r = await ctx.prepare('c1');
    expect(r.rolledOver).toBe(false);
    expect(r.messages.length).toBe(2);
  });

  it('falls back when the summary comes back empty', async () => {
    const { messages, ctx } = setup(jest.fn().mockResolvedValue({ json: { summary: '  ' }, usage }));
    messages.saveMessage('c1', 'user', 'a long opening message');
    messages.saveMessage('c1', 'user', 'a second long message');
    expect((await ctx.prepare('c1')).rolledOver).toBe(false);
  });

  it('never summarizes when switched off', async () => {
    const complete = jest.fn();
    const { messages, ctx } = setup(complete, 1, false);
    messages.saveMessage('c1', 'user', 'a long opening message');
    messages.saveMessage('c1', 'user', 'a second long message');
    expect((await ctx.prepare('c1')).rolledOver).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });
});
