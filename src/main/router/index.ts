// Orchestrates detect -> classify -> rank, and turns the result into a ModelChoice.
import modelsJson from '../../../config/models.json';
import languagesJson from '../../../config/languages.json';
import type { LanguagesConfig, ModelEntry, TaskType } from '../../shared/models';
import { detectLanguage } from '../language/detect';
import type { ModelChoice } from '../providers/openrouter';
import { classifyTask } from './classifier';
import { rankModels } from './policy';

const models = modelsJson as ModelEntry[];
const languages = languagesJson as LanguagesConfig;

const POOL_SIZE = 3;

export type RoutingMode = 'pool' | 'explicit';

export interface RouteDecision {
  language: string;
  task: TaskType;
  choice: ModelChoice;
}

export function route(text: string, mode: RoutingMode, modelOverride?: string): RouteDecision {
  const language = detectLanguage(text);
  const task = classifyTask(text);

  // The user's pick skips routing entirely
  if (modelOverride) return { language, task, choice: { kind: 'explicit', model: modelOverride } };

  const profile = languages[language] ?? languages.default;
  const ranked = rankModels(models, profile, task).map((r) => r.model.id);

  const choice: ModelChoice =
    mode === 'pool'
      ? { kind: 'pool', allowedModels: ranked.slice(0, POOL_SIZE) }
      : { kind: 'explicit', model: ranked[0], fallbacks: ranked.slice(1, POOL_SIZE) };

  return { language, task, choice };
}
