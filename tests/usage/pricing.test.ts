import { baselineCost, cost, netSavings, type PriceTable } from '../../src/main/usage/pricing';
import type { UsageRecord } from '../../src/main/usage/types';

// Round numbers so the expected values are easy to check by hand.
const prices: PriceTable = {
  haiku: { apiId: 'h', inputPerMTok: 1, outputPerMTok: 2 },
  sonnet: { apiId: 's', inputPerMTok: 3, outputPerMTok: 6 },
  opus: { apiId: 'o', inputPerMTok: 10, outputPerMTok: 20 },
};

const rec = (o: Partial<UsageRecord>): UsageRecord => ({
  id: Math.random().toString(36),
  messageId: 'm1',
  parentMessageId: null,
  kind: 'chat',
  model: 'haiku',
  difficulty: 'easy',
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  isUpgrade: false,
  language: 'fr',
  createdAt: 1,
  ...o,
});

describe('cost', () => {
  it('prices input and output separately per million tokens', () => {
    expect(cost('sonnet', 1_000_000, 500_000, prices)).toBe(6);
  });
  it('baselineCost uses the biggest model', () => {
    expect(baselineCost(1_000_000, 1_000_000, prices)).toBe(30);
  });
});

describe('netSavings', () => {
  it('is baseline minus actual for a simple routed message', () => {
    const s = netSavings([rec({})], prices);
    expect(s.baselineCost).toBe(30);
    expect(s.actualCost).toBe(3);
    expect(s.netSaved).toBe(27);
  });

  it('charges classifier overhead against the savings', () => {
    const s = netSavings([rec({}), rec({ kind: 'classifier', inputTokens: 1_000_000, outputTokens: 0 })], prices);
    expect(s.overheadCost).toBe(1);
    expect(s.netSaved).toBe(26);
  });

  it('counts the wasted first attempt and baselines only the final answer once', () => {
    const first = rec({ model: 'haiku', createdAt: 1 });
    const upgrade = rec({
      id: 'u',
      messageId: 'm2',
      parentMessageId: 'm1',
      model: 'sonnet',
      isUpgrade: true,
      createdAt: 2,
    });
    const s = netSavings([first, upgrade], prices);
    expect(s.chatCost).toBe(3);
    expect(s.upgradeCost).toBe(9);
    expect(s.baselineCost).toBe(30);
    expect(s.netSaved).toBe(18);
  });

  it('can go negative when overhead outweighs savings', () => {
    const s = netSavings([rec({ model: 'opus' }), rec({ kind: 'summary', model: 'sonnet' })], prices);
    expect(s.netSaved).toBeLessThan(0);
  });

  it('returns zeros for no records', () => {
    expect(netSavings([], prices).netSaved).toBe(0);
  });
});

describe('netSavings edge cases', () => {
  it('chains of upgrades on one message baseline only the latest answer', () => {
    const records = [
      rec({ id: '1', model: 'haiku', createdAt: 1 }),
      rec({ id: '2', messageId: 'm2', parentMessageId: 'm1', model: 'sonnet', isUpgrade: true, createdAt: 2 }),
      rec({ id: '3', messageId: 'm3', parentMessageId: 'm1', model: 'opus', isUpgrade: true, createdAt: 3 }),
    ];
    const s = netSavings(records, prices);
    expect(s.baselineCost).toBe(30);
    expect(s.upgradeCost).toBe(9 + 30);
    expect(s.netSaved).toBe(30 - (3 + 9 + 30));
  });

  it('an upgrade whose original is not in the list still counts as one answer', () => {
    const s = netSavings([rec({ messageId: 'm2', parentMessageId: 'gone', model: 'sonnet', isUpgrade: true })], prices);
    expect(s.baselineCost).toBe(30);
    expect(s.netSaved).toBe(21);
  });

  it('overhead with no chat answer is pure cost', () => {
    const s = netSavings([rec({ kind: 'summary', model: 'sonnet' })], prices);
    expect(s.baselineCost).toBe(0);
    expect(s.netSaved).toBe(-9);
  });

  it('zero-token chat records cost nothing', () => {
    const s = netSavings([rec({ inputTokens: 0, outputTokens: 0 })], prices);
    expect(s.actualCost).toBe(0);
    expect(s.baselineCost).toBe(0);
  });

  it('answering on the biggest model saves nothing', () => {
    expect(netSavings([rec({ model: 'opus' })], prices).netSaved).toBe(0);
  });

  it('is independent of record order', () => {
    const a = rec({ id: 'a', model: 'haiku', createdAt: 1 });
    const b = rec({ id: 'b', messageId: 'm2', parentMessageId: 'm1', model: 'sonnet', isUpgrade: true, createdAt: 2 });
    expect(netSavings([b, a], prices)).toEqual(netSavings([a, b], prices));
  });
});
