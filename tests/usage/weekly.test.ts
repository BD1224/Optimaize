import { getWeeklyStats } from '../../src/main/ipc/stats';
import { createUsageLogger } from '../../src/main/usage/logger';
import { seedWeek } from '../../src/main/usage/seed';
import { WEEK_MS, weeklyStats } from '../../src/main/usage/weekly';
import type { UsageRecord } from '../../src/main/usage/types';
import { openMemoryDb } from './memdb';

const NOW = 10 * WEEK_MS;
const rec = (o: Partial<UsageRecord>): UsageRecord => ({
  id: Math.random().toString(36),
  messageId: 'm1',
  parentMessageId: null,
  kind: 'chat',
  model: 'haiku',
  difficulty: 'easy',
  inputTokens: 100,
  outputTokens: 50,
  isUpgrade: false,
  language: 'fr',
  createdAt: NOW - 1000,
  ...o,
});

describe('weeklyStats', () => {
  it('counts tokens, calls and per-model totals', () => {
    const s = weeklyStats([rec({}), rec({ model: 'sonnet' })], NOW);
    expect(s.tokensTotal).toBe(300);
    expect(s.calls).toBe(2);
    expect(s.byModel.haiku.calls).toBe(1);
    expect(s.byModel.sonnet.tokens).toBe(150);
  });

  it('ignores records outside the rolling week', () => {
    const s = weeklyStats([rec({ createdAt: NOW - WEEK_MS - 1 }), rec({ createdAt: NOW })], NOW);
    expect(s.calls).toBe(0);
  });

  it('counts upgrades and leaves tips empty', () => {
    const s = weeklyStats([rec({ isUpgrade: true, parentMessageId: 'm0' })], NOW);
    expect(s.upgradeCount).toBe(1);
    expect(s.tips).toEqual([]);
  });

  it('fills in an energy range with low <= high', () => {
    const s = weeklyStats([rec({})], NOW);
    expect(s.energyWh.low > 0).toBe(true);
    expect(s.energyWh.low <= s.energyWh.high).toBe(true);
  });

  it('empty week is all zeros', () => {
    const s = weeklyStats([], NOW);
    expect(s.tokensTotal).toBe(0);
    expect(s.netSaved).toBe(0);
    expect(s.energyWh).toEqual({ low: 0, high: 0 });
  });
});

describe('seedWeek + getWeeklyStats', () => {
  it('is deterministic', () => {
    expect(seedWeek(NOW)).toEqual(seedWeek(NOW));
  });

  it('produces a week with positive net savings end to end through the db', () => {
    const logger = createUsageLogger(openMemoryDb());
    for (const r of seedWeek(NOW)) logger.record(r);
    const s = getWeeklyStats(logger, NOW);
    expect(s.calls).toBeGreaterThan(60);
    expect(s.netSaved).toBeGreaterThan(0);
    expect(s.overheadCost).toBeGreaterThan(0);
  });
});

describe('weeklyStats edge cases', () => {
  it('includes a record exactly one week old and excludes one at now', () => {
    const s = weeklyStats([rec({ createdAt: NOW - WEEK_MS }), rec({ createdAt: NOW })], NOW);
    expect(s.calls).toBe(1);
  });

  it('counts classifier calls in tokens and calls but not as upgrades', () => {
    const s = weeklyStats([rec({ kind: 'classifier', isUpgrade: true })], NOW);
    expect(s.calls).toBe(1);
    expect(s.tokensTotal).toBe(150);
    expect(s.upgradeCount).toBe(0);
  });

  it('reports a negative netSaved when everything ran on the biggest model plus overhead', () => {
    const s = weeklyStats([rec({ model: 'opus' }), rec({ kind: 'classifier' })], NOW);
    expect(s.netSaved).toBeLessThan(0);
  });

  it('getWeeklyStats ignores rows older than a week in the db', () => {
    const logger = createUsageLogger(openMemoryDb());
    logger.record(rec({ id: 'old', createdAt: NOW - WEEK_MS - 5 }));
    logger.record(rec({ id: 'new', createdAt: NOW - 5 }));
    expect(getWeeklyStats(logger, NOW).calls).toBe(1);
  });
});
