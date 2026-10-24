// Bridges Person A's sendMessage() to the usage logger. This is the integration point:
// sendMessage calls deps.usage.log(...); this maps it onto logger.record(...).
import { randomUUID } from 'node:crypto';
import type { SendMessageDeps } from '../ipc/sendMessage';
import type { UsageLogger } from './logger';
import { cost, DEFAULT_PRICES, type PriceTable } from './pricing';
import type { ModelId, UsageRecord } from './types';

export interface UsageAdapterOptions {
  prices?: PriceTable;
  now?: () => number;
  newId?: () => string;
  // Logging must never break a reply that has already streamed, so failures land here.
  onError?: (err: unknown) => void;
}

export function createUsageDep(logger: UsageLogger, opts: UsageAdapterOptions = {}): SendMessageDeps['usage'] {
  const prices = opts.prices ?? DEFAULT_PRICES;
  const now = opts.now ?? Date.now;
  const newId = opts.newId ?? randomUUID;
  const onError = opts.onError ?? ((err) => console.error('usage logging failed', err));

  const modelFor = (apiId: string): ModelId => {
    const hit = (Object.keys(prices) as ModelId[]).find((m) => prices[m].apiId === apiId);
    if (!hit) throw new Error(`Unknown model id "${apiId}"`);
    return hit;
  };

  return {
    log({ model, difficulty, kind, usage, messageId, parentMessageId, isUpgrade, language }) {
      try {
        const m = modelFor(model);
        // Falls back to a fresh id per call when no exchange id is given, so separate
        // messages never collapse into a single baseline.
        const id = newId();
        const rec: UsageRecord = {
          id,
          messageId: messageId ?? id,
          parentMessageId: parentMessageId ?? null,
          kind: kind === 'reply' ? 'chat' : 'classifier',
          model: m,
          difficulty,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          isUpgrade: isUpgrade ?? false,
          language: language ?? null,
          createdAt: now(),
        };
        logger.record(rec);
        return { costUsd: cost(m, usage.inputTokens, usage.outputTokens, prices) };
      } catch (err) {
        onError(err);
        return { costUsd: 0 };
      }
    },
  };
}

// Logs a summarization call (overhead) so it is charged against the savings.
export function createSummaryLogger(logger: UsageLogger, opts: UsageAdapterOptions = {}) {
  const prices = opts.prices ?? DEFAULT_PRICES;
  const now = opts.now ?? Date.now;
  const newId = opts.newId ?? randomUUID;
  const onError = opts.onError ?? ((err) => console.error('usage logging failed', err));

  return ({ model, usage }: { model: string; usage: { inputTokens: number; outputTokens: number } }): void => {
    try {
      const m = (Object.keys(prices) as ModelId[]).find((k) => prices[k].apiId === model);
      if (!m) throw new Error(`Unknown model id "${model}"`);
      const id = newId();
      logger.record({
        id, messageId: id, parentMessageId: null, kind: 'summary', model: m, difficulty: null,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        isUpgrade: false, language: null, createdAt: now(),
      });
    } catch (err) {
      onError(err);
    }
  };
}
