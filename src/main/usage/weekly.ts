import { DEFAULT_ENERGY, energySaved, energyUsed, type EnergyConfig } from './energy';
import { DEFAULT_PRICES, netSavings, type PriceTable } from './pricing';
import type { ModelId, UsageRecord, WeeklyStats } from './types';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Rolling window: the seven days ending at `now`.
export function weeklyStats(
  records: UsageRecord[],
  now: number,
  prices: PriceTable = DEFAULT_PRICES,
  energy: EnergyConfig = DEFAULT_ENERGY,
): WeeklyStats {
  const weekStart = now - WEEK_MS;
  const inWeek = records.filter((r) => r.createdAt >= weekStart && r.createdAt < now);
  const s = netSavings(inWeek, prices);

  const byModel: WeeklyStats['byModel'] = {
    haiku: { calls: 0, tokens: 0 },
    sonnet: { calls: 0, tokens: 0 },
    opus: { calls: 0, tokens: 0 },
  };
  let tokensTotal = 0;
  let upgradeCount = 0;
  for (const r of inWeek) {
    const tokens = r.inputTokens + r.outputTokens;
    const m: ModelId = r.model;
    byModel[m].calls += 1;
    byModel[m].tokens += tokens;
    tokensTotal += tokens;
    if (r.kind === 'chat' && r.isUpgrade) upgradeCount += 1;
  }

  return {
    weekStart,
    weekEnd: now,
    tokensTotal,
    calls: inWeek.length,
    baselineCost: s.baselineCost,
    actualCost: s.actualCost,
    netSaved: s.netSaved,
    upgradeCost: s.upgradeCost,
    overheadCost: s.overheadCost,
    upgradeCount,
    byModel,
    energyWh: energyUsed(inWeek, energy),
    energySavedWh: energySaved(inWeek, energy),
    tips: [],
  };
}
