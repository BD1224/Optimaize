// Groups usage rows into exchanges (one user message plus any Upgrade re-runs) and turns
// them into the "with vs without Optimaize" numbers the UI shows.
//   with    = everything actually spent on the exchange: the classifier, the first attempt,
//             every Upgrade and any summary call
//   without = the final answer alone, priced on the biggest model (what it would have
//             cost with no routing). Tokens: the final answer's own tokens.
import { baselineCost, cost, DEFAULT_PRICES, finalAnswers, type PriceTable } from './pricing';
import type { UsageRecord } from './types';

export interface ExchangeTotals {
  tokensWith: number;
  tokensWithout: number;
  costWith: number;
  costWithout: number;
}

export interface Exchange extends ExchangeTotals {
  root: string;
  final: UsageRecord | null; // null for overhead-only groups such as a summary call
  rows: UsageRecord[];
}

export function groupExchanges(records: UsageRecord[], prices: PriceTable = DEFAULT_PRICES): Exchange[] {
  const byRoot = new Map<string, UsageRecord[]>();
  for (const r of records) {
    const root = r.parentMessageId ?? r.messageId;
    byRoot.set(root, [...(byRoot.get(root) ?? []), r]);
  }

  return [...byRoot.entries()].map(([root, rows]) => {
    const final = finalAnswers(rows)[0] ?? null;
    return {
      root,
      rows,
      final,
      tokensWith: rows.reduce((n, r) => n + r.inputTokens + r.outputTokens, 0),
      tokensWithout: final ? final.inputTokens + final.outputTokens : 0,
      costWith: rows.reduce((n, r) => n + cost(r.model, r.inputTokens, r.outputTokens, prices), 0),
      costWithout: final ? baselineCost(final.inputTokens, final.outputTokens, prices) : 0,
    };
  });
}

export const sumTotals = (exchanges: ExchangeTotals[]): ExchangeTotals =>
  exchanges.reduce(
    (t, e) => ({
      tokensWith: t.tokensWith + e.tokensWith,
      tokensWithout: t.tokensWithout + e.tokensWithout,
      costWith: t.costWith + e.costWith,
      costWithout: t.costWithout + e.costWithout,
    }),
    { tokensWith: 0, tokensWithout: 0, costWith: 0, costWithout: 0 },
  );
