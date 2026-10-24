import type { ModelId, UsageRecord } from './types';

export interface ModelPrice {
  apiId: string;
  inputPerMTok: number; // USD per million input tokens
  outputPerMTok: number; // USD per million output tokens
}

export type PriceTable = Record<ModelId, ModelPrice>;

// The model every saving is measured against.
export const BIGGEST_MODEL: ModelId = 'opus';

// Standard (non-batch, non-cached, global-routing) API prices, USD per million tokens.
// Source: https://platform.claude.com/docs/en/about-claude/pricing, cross-checked against
// https://claude.com/pricing. Re-verify before relying on dollar figures.
// Not modelled: Haiku 5.5 charges $0.50 in / $2.50 out when a prompt exceeds 100K tokens,
// prompt caching, batch (50% off), and the 1.1x US-only inference multiplier.
export const PRICES_LAST_VERIFIED: string | null = '2026-10-24';
export const DEFAULT_PRICES: PriceTable = {
  haiku: { apiId: 'claude-haiku-5-5', inputPerMTok: 0.1, outputPerMTok: 0.5 },
  sonnet: { apiId: 'claude-sonnet-5-5', inputPerMTok: 2, outputPerMTok: 10 },
  opus: { apiId: 'claude-opus-5-5', inputPerMTok: 4, outputPerMTok: 20 },
};

export function cost(
  model: ModelId,
  inputTokens: number,
  outputTokens: number,
  prices: PriceTable = DEFAULT_PRICES,
): number {
  const p = prices[model];
  return (inputTokens * p.inputPerMTok + outputTokens * p.outputPerMTok) / 1_000_000;
}

// What the same call would have cost on the biggest model.
export function baselineCost(
  inputTokens: number,
  outputTokens: number,
  prices: PriceTable = DEFAULT_PRICES,
): number {
  return cost(BIGGEST_MODEL, inputTokens, outputTokens, prices);
}

export interface SavingsBreakdown {
  baselineCost: number; // one biggest-model call per answered message
  chatCost: number; // first-attempt answers actually run
  upgradeCost: number; // Upgrade re-runs
  overheadCost: number; // classifier and summary calls
  actualCost: number; // chatCost + upgradeCost + overheadCost
  netSaved: number; // baselineCost - actualCost (can be negative)
}

// The latest chat answer per original message. An Upgrade's parentMessageId points at
// the original, so a message and its upgrades share one root.
export function finalAnswers(records: UsageRecord[]): UsageRecord[] {
  const answers = new Map<string, UsageRecord>();
  for (const r of records) {
    if (r.kind !== 'chat') continue;
    const root = r.parentMessageId ?? r.messageId;
    const prev = answers.get(root);
    if (!prev || r.createdAt >= prev.createdAt) answers.set(root, r);
  }
  return [...answers.values()];
}

// Net savings: the baseline is what the final answer would have cost on the biggest
// model; the actual cost includes wasted first attempts and routing overhead.
export function netSavings(
  records: UsageRecord[],
  prices: PriceTable = DEFAULT_PRICES,
): SavingsBreakdown {
  let chatCost = 0;
  let upgradeCost = 0;
  let overheadCost = 0;

  for (const r of records) {
    const c = cost(r.model, r.inputTokens, r.outputTokens, prices);
    if (r.kind !== 'chat') overheadCost += c;
    else if (r.isUpgrade) upgradeCost += c;
    else chatCost += c;
  }

  let baseline = 0;
  for (const a of finalAnswers(records)) {
    baseline += baselineCost(a.inputTokens, a.outputTokens, prices);
  }

  const actualCost = chatCost + upgradeCost + overheadCost;
  return {
    baselineCost: baseline,
    chatCost,
    upgradeCost,
    overheadCost,
    actualCost,
    netSaved: baseline - actualCost,
  };
}
