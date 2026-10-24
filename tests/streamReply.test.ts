import { createStreamReply, type StreamingClient } from '../src/main/providers/anthropic';

function fakeClient(deltas: string[], usage = { input_tokens: 12, output_tokens: 34 }) {
  const params: unknown[] = [];
  const client: StreamingClient = {
    messages: {
      stream: (p) => {
        params.push(p);
        let listener: (d: string) => void = () => {};
        return {
          on: (_e, l) => { listener = l; },
          finalMessage: async () => {
            deltas.forEach(listener);
            return { content: [{ type: 'text', text: deltas.join('') }], usage };
          },
        };
      },
    },
  };
  return { client, params };
}

describe('createStreamReply', () => {
  it('streams tokens, returns the full text and the real usage', async () => {
    const { client, params } = fakeClient(['Hel', 'lo']);
    const seen: string[] = [];
    const reply = createStreamReply(() => 'key', () => client);
    const result = await reply({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'hi' }], onToken: (d) => seen.push(d) });
    expect(seen).toEqual(['Hel', 'lo']);
    expect(result).toEqual({ text: 'Hello', usage: { inputTokens: 12, outputTokens: 34 } });
    expect((params[0] as { model: string }).model).toBe('claude-haiku-5-5');
  });

  it('reads the API key lazily, per call', async () => {
    const { client } = fakeClient(['x']);
    let key = 'a';
    const used: string[] = [];
    const reply = createStreamReply(() => key, (k) => { used.push(k); return client; });
    await reply({ model: 'm', messages: [], onToken: () => {} });
    key = 'b';
    await reply({ model: 'm', messages: [], onToken: () => {} });
    expect(used).toEqual(['a', 'b']);
  });

  it('ignores non-text blocks', async () => {
    const client: StreamingClient = {
      messages: { stream: () => ({ on: () => {}, finalMessage: async () => ({
        content: [{ type: 'thinking' }, { type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }) }) },
    };
    const r = await createStreamReply(() => 'k', () => client)({ model: 'm', messages: [], onToken: () => {} });
    expect(r.text).toBe('ok');
  });
});
