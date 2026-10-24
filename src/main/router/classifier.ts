// Cheap Haiku call: classifies a message by category and difficulty
import type { Category, Difficulty, TokenUsage } from '../../shared/chat';
import type { Complete } from '../providers/anthropic';
import { CLASSIFIER_MODEL } from './models';

export interface Classification {
  category: Category;
  difficulty: Difficulty;
  // Tokens the classifier call itself used (zero if it was skipped or failed)
  usage: TokenUsage;
}

const CATEGORIES: readonly Category[] = ['chat', 'writing', 'code', 'analysis', 'design', 'math'];
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

const FALLBACK = { category: 'chat', difficulty: 'medium' } as const;
const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };

const TIMEOUT_MS = 3000;

// Always English, whatever language the user writes in, so it costs the same for everyone
const SYSTEM_PROMPT = `You classify a user's message so it can be sent to the cheapest AI model that can handle it.
Reply with JSON only. The message may be in any language.

category:
- chat: casual conversation, simple questions, lookups, translation, summarizing
- writing: drafting or editing emails, essays, stories, marketing copy
- code: writing, debugging or explaining code
- analysis: analyzing data, documents or arguments, research, comparisons
- design: system design, architecture, planning, technical strategy
- math: calculations, proofs, quantitative or logical reasoning

difficulty:
- easy: short, direct, one step
- medium: a few steps or some domain knowledge
- hard: multi-step reasoning, large scope, or expert-level depth`;

const SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CATEGORIES] },
    difficulty: { type: 'string', enum: [...DIFFICULTIES] },
  },
  required: ['category', 'difficulty'],
  additionalProperties: false,
};

// Obvious one-word replies don't need a model call
const ACKNOWLEDGEMENTS = new Set([
  'ok', 'okay', 'thanks', 'thank you', 'thx', 'yes', 'no',
  'merci', 'oui', 'non', 'gracias', 'si', 'sí', 'obrigado', 'obrigada', 'sim', 'danke', 'ja', 'nein',
]);

function isTrivial(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  return ACKNOWLEDGEMENTS.has(normalized);
}

export function parseClassification(json: unknown): { category: Category; difficulty: Difficulty } | null {
  if (typeof json !== 'object' || json === null) return null;
  const { category, difficulty } = json as Record<string, unknown>;
  if (!CATEGORIES.includes(category as Category)) return null;
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) return null;
  return { category: category as Category, difficulty: difficulty as Difficulty };
}

export function createClassifier(complete: Complete): (text: string) => Promise<Classification> {
  return async (text) => {
    if (isTrivial(text)) return { category: 'chat', difficulty: 'easy', usage: NO_USAGE };

    // A failed classifier must never block a message, so any problem falls back to chat/medium
    try {
      const { json, usage } = await complete({
        model: CLASSIFIER_MODEL,
        system: SYSTEM_PROMPT,
        user: text,
        schema: SCHEMA,
        maxTokens: 64,
        timeoutMs: TIMEOUT_MS,
      });
      const parsed = parseClassification(json);
      return parsed ? { ...parsed, usage } : { ...FALLBACK, usage };
    } catch {
      return { ...FALLBACK, usage: NO_USAGE };
    }
  };
}
