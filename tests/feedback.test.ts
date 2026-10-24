import { createFeedback, memoryStore, UPGRADES_BEFORE_OVERRIDE } from '../src/main/router/feedback';
import { MODELS, nextModel } from '../src/main/router/models';
import { pickModel } from '../src/main/router/policy';

describe('nextModel', () => {
  it('climbs haiku -> sonnet -> opus and stops', () => {
    expect(nextModel(MODELS.haiku)).toBe(MODELS.sonnet);
    expect(nextModel(MODELS.sonnet)).toBe(MODELS.opus);
    expect(nextModel(MODELS.opus)).toBeNull();
  });
  it('returns null for an unknown model', () => {
    expect(nextModel('claude-mystery-9')).toBeNull();
  });
});

describe('feedback', () => {
  const up = { category: 'code', difficulty: 'medium', toModel: MODELS.opus } as const;

  it('has no overrides before any upgrade', () => {
    expect(createFeedback().getOverrides()).toEqual({});
  });

  it('needs repeated upgrades before it overrides the policy', () => {
    const f = createFeedback();
    for (let i = 1; i < UPGRADES_BEFORE_OVERRIDE; i++) f.recordUpgrade(up);
    expect(f.getOverrides()).toEqual({});
    f.recordUpgrade(up);
    expect(f.getOverrides()).toEqual({ 'code:medium': MODELS.opus });
  });

  it('only affects the category and difficulty that were upgraded', () => {
    const f = createFeedback();
    f.recordUpgrade(up);
    f.recordUpgrade(up);
    const o = f.getOverrides();
    expect(pickModel('code', 'medium', o)).toBe(MODELS.opus);
    expect(pickModel('code', 'easy', o)).toBe(MODELS.haiku);
    expect(pickModel('writing', 'medium', o)).toBe(MODELS.sonnet);
  });

  it('uses the most recent upgrade target', () => {
    const f = createFeedback();
    f.recordUpgrade({ ...up, toModel: MODELS.sonnet });
    f.recordUpgrade({ ...up, toModel: MODELS.opus });
    expect(f.getOverrides()['code:medium']).toBe(MODELS.opus);
  });

  it('reads and writes through the store, so it can be persisted', () => {
    const store = memoryStore();
    createFeedback(store).recordUpgrade(up);
    createFeedback(store).recordUpgrade(up);
    expect(createFeedback(store).getOverrides()).toEqual({ 'code:medium': MODELS.opus });
  });
});
