// Model IDs used by the router, in one place
export const MODELS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
} as const;

export const CLASSIFIER_MODEL = MODELS.haiku;

// Used when routing is turned off
export const DEFAULT_MODEL = MODELS.sonnet;
