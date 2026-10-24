// One row per OpenRouter call

export interface UsageRecord {
  id: string;
  messageId: string;
  // Set when the user re-sent a message on another model
  isRetry: boolean;
  model: string;
  // ISO 639-1 code
  language: string | null;
  inputTokens: number;
  outputTokens: number;
  // 0 for free models
  costUsd: number;
  // Same tokens priced on the most expensive model in the pool
  baselineCostUsd: number;
  createdAt: number;
}
