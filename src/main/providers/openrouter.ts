// OpenRouter client: one non-streaming chat completion per call.
import type { TokenUsage } from '../../shared/chat';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Either an explicit model (user override, or our own pick) or a pool that
// OpenRouter's auto router chooses from.
export type ModelChoice =
  | { kind: 'explicit'; model: string; fallbacks?: string[] }
  | { kind: 'pool'; allowedModels: string[] };

export interface CompletionResult {
  content: string;
  // The model that actually answered, as reported by OpenRouter
  model: string;
  usage: TokenUsage;
  // 0 for free models
  costUsd: number;
}

export class OpenRouterError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function buildBody(messages: LlmMessage[], choice: ModelChoice): Record<string, unknown> {
  if (choice.kind === 'explicit') {
    const body: Record<string, unknown> = { model: choice.model, messages };
    // OpenRouter tries these in order only if the first model errors
    if (choice.fallbacks?.length) body.models = [choice.model, ...choice.fallbacks];
    return body;
  }
  // The "auto-router" plugin / "allowed_models" names are unverified against the docs
  return {
    model: 'openrouter/auto',
    messages,
    plugins: [{ id: 'auto-router', allowed_models: choice.allowedModels }],
  };
}

export async function complete(
  apiKey: string,
  messages: LlmMessage[],
  choice: ModelChoice,
): Promise<CompletionResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(messages, choice)),
  });

  const data: any = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const detail = data?.error?.metadata?.raw;
    const message = data?.error?.message ?? `OpenRouter request failed (${res.status})`;
    throw new OpenRouterError(detail ? `${message}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : message, res.status);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new OpenRouterError('OpenRouter returned no message content');

  return {
    content,
    model: data.model,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
    costUsd: data.usage?.cost ?? 0,
  };
}
