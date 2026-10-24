// Anthropic Messages API client with streaming support
import Anthropic from '@anthropic-ai/sdk';
import type { TokenUsage } from '../../shared/chat';

export interface CompleteArgs {
  model: string;
  system: string;
  user: string;
  // JSON schema the reply must match
  schema: Record<string, unknown>;
  maxTokens: number;
  timeoutMs: number;
}

export interface CompleteResult {
  json: unknown;
  usage: TokenUsage;
}

export type Complete = (args: CompleteArgs) => Promise<CompleteResult>;

// Small non-streaming call that returns schema-constrained JSON. Used by the router's
// classifier so it never touches the API key or the network itself.
export function createComplete(getApiKey: () => string): Complete {
  return async ({ model, system, user, schema, maxTokens, timeoutMs }) => {
    const client = new Anthropic({ apiKey: getApiKey() });
    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      },
      { timeout: timeoutMs, maxRetries: 0 },
    );

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text block in response');

    return {
      json: JSON.parse(block.text),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  };
}

// Streaming chat reply. The renderer never sees the key or the network; tokens reach it
// through onToken. `makeClient` exists so tests can supply a fake instead of the paid API.
export interface StreamReplyArgs {
  model: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  onToken: (delta: string) => void;
}

export type StreamReply = (args: StreamReplyArgs) => Promise<{ text: string; usage: TokenUsage }>;

export interface StreamingClient {
  messages: {
    stream(params: {
      model: string;
      max_tokens: number;
      messages: { role: 'user' | 'assistant'; content: string }[];
    }): {
      on(event: 'text', listener: (delta: string) => void): unknown;
      finalMessage(): Promise<{
        content: { type: string; text?: string }[];
        usage: { input_tokens: number; output_tokens: number };
      }>;
    };
  };
}

const REPLY_MAX_TOKENS = 4096;

export function createStreamReply(
  getApiKey: () => string,
  makeClient: (apiKey: string) => StreamingClient = (apiKey) =>
    new Anthropic({ apiKey }) as unknown as StreamingClient,
): StreamReply {
  return async ({ model, messages, onToken }) => {
    const stream = makeClient(getApiKey()).messages.stream({
      model,
      max_tokens: REPLY_MAX_TOKENS,
      messages,
    });
    stream.on('text', onToken);
    const final = await stream.finalMessage();

    return {
      text: final.content.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join(''),
      usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
    };
  };
}

// Checks that an API key works, using the free token-counting endpoint (no tokens billed).
export interface CountingClient {
  messages: {
    countTokens(params: {
      model: string;
      messages: { role: 'user'; content: string }[];
    }): Promise<unknown>;
  };
}

export type CheckKey = (apiKey: string) => Promise<{ valid: boolean; error?: string }>;

export function createCheckKey(
  makeClient: (apiKey: string) => CountingClient = (apiKey) =>
    new Anthropic({ apiKey, maxRetries: 0 }) as unknown as CountingClient,
  model = 'claude-haiku-5-5',
): CheckKey {
  return async (apiKey) => {
    try {
      await makeClient(apiKey).messages.countTokens({ model, messages: [{ role: 'user', content: 'hi' }] });
      return { valid: true };
    } catch (err) {
      const status = (err as { status?: number }).status;
      // Only a rejected key means invalid; network trouble says nothing about the key
      if (status === 401 || status === 403) return { valid: false, error: 'The API key was rejected' };
      return { valid: false, error: 'Could not reach Anthropic to check the key' };
    }
  };
}
