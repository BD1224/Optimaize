// Shapes of the editable data files in config/

export type TaskType = 'chat' | 'writing' | 'code' | 'analysis' | 'math';

export interface ModelEntry {
  // OpenRouter model ID, e.g. "meta-llama/llama-3.3-70b-instruct:free"
  id: string;
  free: boolean;
  contextLength: number;
  // USD per million tokens; 0 for free models
  inputPricePerM: number;
  outputPricePerM: number;
  // Task types this model is good at
  strengths: TaskType[];
}

export interface LanguageProfile {
  // Model ID -> strength in this language, 0 (poor) to 1 (excellent)
  modelScores: Record<string, number>;
  // Rough tokens-per-word relative to English (1.0 = same as English)
  tokenCostMultiplier: number;
  // Where the scores came from
  sources: string[];
}

// Keyed by ISO 639-1 code; "default" is used for unlisted languages
export type LanguagesConfig = Record<string, LanguageProfile>;
