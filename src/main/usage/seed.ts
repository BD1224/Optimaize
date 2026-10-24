import type { Difficulty, ModelId, UsageRecord } from './types';

const DAY = 24 * 60 * 60 * 1000;

// Small deterministic PRNG so the seeded week is the same every run.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const MODEL_FOR: Record<Difficulty, ModelId> = { easy: 'haiku', medium: 'sonnet', hard: 'opus' };
const NEXT: Record<ModelId, ModelId> = { haiku: 'sonnet', sonnet: 'opus', opus: 'opus' };

// A realistic fake week ending at `now`: routed chats, a classifier call per message,
// and an occasional Upgrade re-run. Stand-in for Person A's real calls.
export function seedWeek(now: number, messages = 60, seed = 1): UsageRecord[] {
  const rand = rng(seed);
  const out: UsageRecord[] = [];
  const langs = ['fr', 'es', 'hi', 'en'];

  for (let i = 0; i < messages; i++) {
    const t = now - Math.floor(rand() * 6.9 * DAY) - 1000;
    const roll = rand();
    const difficulty: Difficulty = roll < 0.5 ? 'easy' : roll < 0.85 ? 'medium' : 'hard';
    const model = MODEL_FOR[difficulty];
    const language = langs[Math.floor(rand() * langs.length)];
    const inputTokens = 200 + Math.floor(rand() * 1800);
    const outputTokens = 100 + Math.floor(rand() * 1500);
    const messageId = `msg-${i}`;
    const base = { parentMessageId: null, difficulty, language, isUpgrade: false };

    out.push({ ...base, id: `${messageId}-cls`, messageId, kind: 'classifier', model: 'haiku',
      inputTokens: 150, outputTokens: 10, createdAt: t });
    out.push({ ...base, id: `${messageId}-chat`, messageId, kind: 'chat', model,
      inputTokens, outputTokens, createdAt: t + 1 });

    if (model !== 'opus' && rand() < 0.12) {
      out.push({ ...base, id: `${messageId}-up`, messageId: `${messageId}-up`, parentMessageId: messageId,
        kind: 'chat', model: NEXT[model], inputTokens, outputTokens: outputTokens + 200,
        isUpgrade: true, createdAt: t + 5000 });
    }
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}
