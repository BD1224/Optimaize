// Baseline cost: the same tokens priced on the most expensive model in the registry.
import modelsJson from '../../../config/models.json';
import type { TokenUsage } from '../../shared/chat';
import type { ModelEntry } from '../../shared/models';

const models = modelsJson as ModelEntry[];

export function baselineCost(usage: TokenUsage): number {
  return Math.max(
    0,
    ...models.map((m) => (usage.inputTokens * m.inputPricePerM + usage.outputTokens * m.outputPricePerM) / 1_000_000),
  );
}
