// Maps (category, difficulty) -> model, plus applies learned overrides
import type { Category, Difficulty } from '../../shared/chat';
import { MODELS } from './models';

const { haiku, sonnet, opus } = MODELS;

// First draft based on Anthropic's model guidance; meant to be tuned against real prompts.
// Rows are categories, columns are [easy, medium, hard].
const TABLE: Record<Category, Record<Difficulty, string>> = {
  chat: { easy: haiku, medium: haiku, hard: sonnet },
  writing: { easy: haiku, medium: sonnet, hard: sonnet },
  code: { easy: haiku, medium: sonnet, hard: opus },
  analysis: { easy: haiku, medium: sonnet, hard: opus },
  design: { easy: sonnet, medium: opus, hard: opus },
  math: { easy: sonnet, medium: opus, hard: opus },
};

// Same mapping if the category is missing from the table
const BY_DIFFICULTY: Record<Difficulty, string> = { easy: haiku, medium: sonnet, hard: opus };

// Learned overrides from feedback.ts, keyed "category:difficulty"
export type Overrides = Partial<Record<string, string>>;

export function pickModel(category: Category, difficulty: Difficulty, overrides: Overrides = {}): string {
  return overrides[`${category}:${difficulty}`] ?? TABLE[category]?.[difficulty] ?? BY_DIFFICULTY[difficulty];
}
