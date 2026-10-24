import { DEFAULT_ENERGY, energySaved, energyUsed, type EnergyConfig } from '../../src/main/usage/energy';
import type { UsageRecord } from '../../src/main/usage/types';

// Round coefficients so expected values are checkable by hand.
const cfg: EnergyConfig = {
  perModel: {
    haiku: { lowWhPerOutputToken: 1, highWhPerOutputToken: 2 },
    sonnet: { lowWhPerOutputToken: 3, highWhPerOutputToken: 6 },
    opus: { lowWhPerOutputToken: 10, highWhPerOutputToken: 20 },
  },
  inputTokenWeight: 0,
};

const rec = (o: Partial<UsageRecord>): UsageRecord => ({
  id: Math.random().toString(36),
  messageId: 'm1',
  parentMessageId: null,
  kind: 'chat',
  model: 'haiku',
  difficulty: 'easy',
  inputTokens: 1000,
  outputTokens: 10,
  isUpgrade: false,
  language: 'fr',
  createdAt: 1,
  ...o,
});

describe('energyUsed', () => {
  it('multiplies output tokens by the model coefficients', () => {
    expect(energyUsed([rec({})], cfg)).toEqual({ low: 10, high: 20 });
  });
  it('ignores input tokens by default and weights them when configured', () => {
    expect(energyUsed([rec({})], { ...cfg, inputTokenWeight: 0.01 }).low).toBe(20);
  });
  it('includes overhead calls', () => {
    expect(energyUsed([rec({}), rec({ kind: 'classifier', outputTokens: 5 })], cfg).low).toBe(15);
  });
  it('is zero for no records', () => {
    expect(energyUsed([], cfg)).toEqual({ low: 0, high: 0 });
  });
});

describe('energySaved', () => {
  it('is Opus-for-the-answer minus what was used', () => {
    expect(energySaved([rec({})], cfg)).toEqual({ low: 90, high: 180 });
  });
  it('subtracts the wasted first attempt on an upgraded message', () => {
    const up = rec({ messageId: 'm2', parentMessageId: 'm1', model: 'sonnet', isUpgrade: true, createdAt: 2 });
    expect(energySaved([rec({}), up], cfg).low).toBe(100 - (10 + 30));
  });
  it('is zero when everything already ran on the biggest model', () => {
    expect(energySaved([rec({ model: 'opus' })], cfg)).toEqual({ low: 0, high: 0 });
  });
  it('can be negative with overhead', () => {
    expect(energySaved([rec({ model: 'opus' }), rec({ kind: 'summary', model: 'sonnet' })], cfg).low < 0).toBe(true);
  });
});

describe('DEFAULT_ENERGY', () => {
  it('keeps low <= high and orders haiku < sonnet < opus', () => {
    const c = DEFAULT_ENERGY.perModel;
    for (const m of ['haiku', 'sonnet', 'opus'] as const) {
      expect(c[m].lowWhPerOutputToken <= c[m].highWhPerOutputToken).toBe(true);
    }
    expect(c.haiku.lowWhPerOutputToken < c.sonnet.lowWhPerOutputToken).toBe(true);
    expect(c.sonnet.lowWhPerOutputToken < c.opus.lowWhPerOutputToken).toBe(true);
  });
});
