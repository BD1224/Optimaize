import type { Complete } from '../src/main/providers/anthropic';
import { createClassifier, parseClassification } from '../src/main/router/classifier';
import { createRouter } from '../src/main/router';
import { MODELS, DEFAULT_MODEL } from '../src/main/router/models';
import { pickModel } from '../src/main/router/policy';

const usage = { inputTokens: 120, outputTokens: 10 };

function fakeComplete(json: unknown): jest.MockedFunction<Complete> {
  return jest.fn().mockResolvedValue({ json, usage });
}

describe('policy', () => {
  it('maps category and difficulty to a model', () => {
    expect(pickModel('chat', 'easy')).toBe(MODELS.haiku);
    expect(pickModel('code', 'medium')).toBe(MODELS.sonnet);
    expect(pickModel('design', 'hard')).toBe(MODELS.opus);
  });

  it('applies learned overrides', () => {
    expect(pickModel('code', 'medium', { 'code:medium': MODELS.opus })).toBe(MODELS.opus);
  });

  it('falls back to the difficulty mapping for an unknown category', () => {
    expect(pickModel('mystery' as never, 'hard')).toBe(MODELS.opus);
  });
});

describe('parseClassification', () => {
  it('accepts valid output', () => {
    expect(parseClassification({ category: 'code', difficulty: 'hard' })).toEqual({
      category: 'code',
      difficulty: 'hard',
    });
  });

  it.each([null, 'code', {}, { category: 'code' }, { category: 'poetry', difficulty: 'easy' }])(
    'rejects %p',
    (bad) => {
      expect(parseClassification(bad)).toBeNull();
    },
  );
});

describe('classifier', () => {
  it('returns the model call result with its usage', async () => {
    const complete = fakeComplete({ category: 'design', difficulty: 'hard' });
    const result = await createClassifier(complete)('How should I structure a multi-tenant system?');
    expect(result).toEqual({ category: 'design', difficulty: 'hard', usage });
    expect(complete.mock.calls[0][0].model).toBe(MODELS.haiku);
  });

  it('sends the full text without truncating it', async () => {
    const complete = fakeComplete({ category: 'chat', difficulty: 'easy' });
    const long = 'x'.repeat(20000);
    await createClassifier(complete)(long);
    expect(complete.mock.calls[0][0].user).toBe(long);
  });

  it('skips the call for trivial messages', async () => {
    const complete = fakeComplete({ category: 'code', difficulty: 'hard' });
    const result = await createClassifier(complete)('Merci !');
    expect(complete).not.toHaveBeenCalled();
    expect(result).toEqual({
      category: 'chat',
      difficulty: 'easy',
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  });

  it('falls back to chat/medium on unparseable output but keeps the usage', async () => {
    const result = await createClassifier(fakeComplete({ nope: true }))('hello there, help me');
    expect(result).toEqual({ category: 'chat', difficulty: 'medium', usage });
  });

  it('falls back to chat/medium when the call fails', async () => {
    const complete: Complete = jest.fn().mockRejectedValue(new Error('timeout'));
    const result = await createClassifier(complete)('hello there, help me');
    expect(result).toEqual({
      category: 'chat',
      difficulty: 'medium',
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  });
});

describe('router', () => {
  it('classifies and picks a model', async () => {
    const classify = createClassifier(fakeComplete({ category: 'code', difficulty: 'hard' }));
    const router = createRouter({ classify, isEnabled: () => true });
    const result = await router.route('refactor this module');
    expect(result).toEqual({
      model: MODELS.opus,
      category: 'code',
      difficulty: 'hard',
      classifier: { model: MODELS.haiku, usage },
    });
  });

  it('uses learned overrides', async () => {
    const classify = createClassifier(fakeComplete({ category: 'code', difficulty: 'medium' }));
    const router = createRouter({
      classify,
      isEnabled: () => true,
      getOverrides: () => ({ 'code:medium': MODELS.opus }),
    });
    expect((await router.route('fix this bug please')).model).toBe(MODELS.opus);
  });

  it('skips the classifier when routing is disabled', async () => {
    const classify = jest.fn();
    const router = createRouter({ classify, isEnabled: () => false });
    const result = await router.route('anything');
    expect(classify).not.toHaveBeenCalled();
    expect(result.model).toBe(DEFAULT_MODEL);
    expect(result.classifier.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
