import type { ChatMessage } from '../src/shared/chat';
import { sendMessage, type SendMessageDeps } from '../src/main/ipc/sendMessage';

function message(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: `${role}-1`, chatId: 'c1', role, content, createdAt: 0 };
}

function makeDeps(classifierTokens: number): { deps: SendMessageDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: SendMessageDeps = {
    db: {
      saveMessage: (_chatId, role, content) => {
        calls.push(`db:${role}`);
        return message(role, content);
      },
    },
    context: {
      prepare: async () => {
        calls.push('context');
        return { chatId: 'c1', messages: [message('user', 'hi')], rolledOver: false };
      },
    },
    router: {
      route: async () => {
        calls.push('router');
        return {
          model: 'claude-haiku-5-5',
          category: 'chat',
          difficulty: 'easy',
          classifier: {
            model: 'claude-haiku-5-5',
            usage: { inputTokens: classifierTokens, outputTokens: 0 },
          },
        };
      },
    },
    providers: {
      streamReply: async ({ onToken }) => {
        calls.push('providers');
        onToken('hel');
        onToken('lo');
        return { text: 'hello', usage: { inputTokens: 5, outputTokens: 2 } };
      },
    },
    usage: {
      log: ({ kind }) => {
        calls.push(`usage:${kind}`);
        return { costUsd: kind === 'classifier' ? 0.25 : 1 };
      },
    },
  };
  return { deps, calls };
}

describe('sendMessage', () => {
  it('runs the steps in order and logs the classifier call', async () => {
    const { deps, calls } = makeDeps(100);
    const tokens: string[] = [];
    const result = await sendMessage(deps, { chatId: 'c1', text: 'hi' }, (t) => tokens.push(t));

    expect(calls).toEqual([
      'db:user',
      'context',
      'router',
      'providers',
      'usage:classifier',
      'usage:reply',
      'db:assistant',
    ]);
    expect(tokens).toEqual(['hel', 'lo']);
    expect(result.reply.content).toBe('hello');
    expect(result.category).toBe('chat');
    expect(result.costUsd).toBe(1.25);
  });

  it('does not log a classifier call that did not run', async () => {
    const { deps, calls } = makeDeps(0);
    const result = await sendMessage(deps, { chatId: 'c1', text: 'ok' }, () => {});
    expect(calls).not.toContain('usage:classifier');
    expect(result.costUsd).toBe(1);
  });
});
