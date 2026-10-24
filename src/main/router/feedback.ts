// Upgrade clicks update the routing policy.
// When users keep upgrading the same kind of question, route it to the bigger model next time.
import type { Category, Difficulty } from '../../shared/chat';
import type { Overrides } from './policy';

export interface UpgradeStat {
  count: number;
  // The model users escalated to most recently for this kind of question
  toModel: string;
}

export type FeedbackState = Record<string, UpgradeStat>;

// Persistence hook. In memory by default; swap for a SQLite-backed one once the DB layer exists.
export interface FeedbackStore {
  load(): FeedbackState;
  save(state: FeedbackState): void;
}

// Upgrades needed before a (category, difficulty) pair is re-routed. One click can be a
// one-off; two means the policy is probably too cheap for this kind of question.
export const UPGRADES_BEFORE_OVERRIDE = 2;

export function memoryStore(initial: FeedbackState = {}): FeedbackStore {
  let state = initial;
  return { load: () => state, save: (s) => { state = s; } };
}

export interface Feedback {
  recordUpgrade(args: { category: Category; difficulty: Difficulty; toModel: string }): void;
  getOverrides(): Overrides;
}

export function createFeedback(store: FeedbackStore = memoryStore()): Feedback {
  return {
    recordUpgrade({ category, difficulty, toModel }) {
      const key = `${category}:${difficulty}`;
      const state = store.load();
      store.save({ ...state, [key]: { count: (state[key]?.count ?? 0) + 1, toModel } });
    },
    getOverrides() {
      const overrides: Overrides = {};
      for (const [key, stat] of Object.entries(store.load())) {
        if (stat.count >= UPGRADES_BEFORE_OVERRIDE) overrides[key] = stat.toModel;
      }
      return overrides;
    },
  };
}
