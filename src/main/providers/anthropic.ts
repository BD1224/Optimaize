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
