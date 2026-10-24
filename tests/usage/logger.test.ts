import { createUsageLogger } from '../../src/main/usage/logger';
import type { UsageRecord } from '../../src/main/usage/types';
import { openMemoryDb } from './memdb';

const rec = (o: Partial<UsageRecord>): UsageRecord => ({
  id: 'a',
  messageId: 'm1',
  parentMessageId: null,
  kind: 'chat',
  model: 'haiku',
  difficulty: 'easy',
  inputTokens: 10,
  outputTokens: 20,
  isUpgrade: false,
  language: 'es',
  createdAt: 100,
  ...o,
});

describe('usage logger', () => {
  it('round-trips a record, including nulls and booleans', () => {
    const log = createUsageLogger(openMemoryDb());
    const r = rec({ language: null, difficulty: null, isUpgrade: true, parentMessageId: 'm0' });
    log.record(r);
    expect(log.list(0, 1000)).toEqual([r]);
  });

  it('filters by time window [since, until) and orders oldest first', () => {
    const log = createUsageLogger(openMemoryDb());
    log.record(rec({ id: 'late', createdAt: 300 }));
    log.record(rec({ id: 'early', createdAt: 100 }));
    log.record(rec({ id: 'out', createdAt: 500 }));
    expect(log.list(100, 500).map((r) => r.id)).toEqual(['early', 'late']);
  });

  it('can be created twice on the same db', () => {
    const db = openMemoryDb();
    createUsageLogger(db);
    expect(() => createUsageLogger(db)).not.toThrow();
  });
});

describe('usage logger edge cases', () => {
  it('rejects negative, fractional and NaN token counts', () => {
    const log = createUsageLogger(openMemoryDb());
    expect(() => log.record(rec({ inputTokens: -1 }))).toThrow();
    expect(() => log.record(rec({ outputTokens: 1.5 }))).toThrow();
    expect(() => log.record(rec({ outputTokens: NaN }))).toThrow();
    expect(log.list(0, 1000)).toEqual([]);
  });

  it('accepts zero tokens', () => {
    const log = createUsageLogger(openMemoryDb());
    log.record(rec({ inputTokens: 0, outputTokens: 0 }));
    expect(log.list(0, 1000).length).toBe(1);
  });

  it('rejects a duplicate record id instead of silently overwriting', () => {
    const log = createUsageLogger(openMemoryDb());
    log.record(rec({ id: 'dup' }));
    expect(() => log.record(rec({ id: 'dup' }))).toThrow();
    expect(log.list(0, 1000).length).toBe(1);
  });

  it('treats since as inclusive and until as exclusive at the exact boundary', () => {
    const log = createUsageLogger(openMemoryDb());
    log.record(rec({ id: 'at-since', createdAt: 100 }));
    log.record(rec({ id: 'at-until', createdAt: 200 }));
    expect(log.list(100, 200).map((r) => r.id)).toEqual(['at-since']);
  });

  it('keeps same-timestamp records (no uniqueness on createdAt)', () => {
    const log = createUsageLogger(openMemoryDb());
    log.record(rec({ id: 'a', createdAt: 100 }));
    log.record(rec({ id: 'b', createdAt: 100 }));
    expect(log.list(0, 1000).length).toBe(2);
  });

  it('returns an empty list for an empty or inverted window', () => {
    const log = createUsageLogger(openMemoryDb());
    log.record(rec({ createdAt: 100 }));
    expect(log.list(500, 600)).toEqual([]);
    expect(log.list(200, 100)).toEqual([]);
  });
});
