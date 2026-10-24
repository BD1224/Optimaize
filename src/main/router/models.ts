// Model IDs used by the router, in one place
export const MODELS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
} as const;

export const CLASSIFIER_MODEL = MODELS.haiku;

// Used when routing is turned off
export const DEFAULT_MODEL = MODELS.sonnet;

// The Upgrade button moves one step up this ladder.
const LADDER: readonly string[] = [MODELS.haiku, MODELS.sonnet, MODELS.opus];

export function nextModel(model: string): string | null {
  const i = LADDER.indexOf(model);
  return i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1] : null;
}
