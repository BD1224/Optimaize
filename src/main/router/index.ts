// Router entry: classify the message, then pick the model
import type { Category, Difficulty, TokenUsage } from '../../shared/chat';
import type { Classification } from './classifier';
import { CLASSIFIER_MODEL, DEFAULT_MODEL } from './models';
import { pickModel, type Overrides } from './policy';

export interface RouteResult {
  model: string;
  category: Category;
  difficulty: Difficulty;
  // The classifier call, so its cost is counted in usage
  classifier: { model: string; usage: TokenUsage };
}

export interface RouterDeps {
  classify: (text: string) => Promise<Classification>;
  isEnabled: () => boolean;
  getOverrides?: () => Overrides;
}

export function createRouter(deps: RouterDeps): { route(text: string): Promise<RouteResult> } {
  return {
    async route(text) {
      if (!deps.isEnabled()) {
        return {
          model: DEFAULT_MODEL,
          category: 'chat',
          difficulty: 'medium',
          classifier: { model: CLASSIFIER_MODEL, usage: { inputTokens: 0, outputTokens: 0 } },
        };
      }

      const { category, difficulty, usage } = await deps.classify(text);
      return {
        model: pickModel(category, difficulty, deps.getOverrides?.()),
        category,
        difficulty,
        classifier: { model: CLASSIFIER_MODEL, usage },
      };
    },
  };
}
