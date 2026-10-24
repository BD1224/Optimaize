// Ranks candidate models for a (language, task) pair.
import type { LanguageProfile, ModelEntry, TaskType } from '../../shared/models';

const TASK_WEIGHT = 0.3;
// Score assumed for a model the language profile doesn't mention
const UNKNOWN_LANGUAGE_SCORE = 0.3;

export interface RankedModel {
  model: ModelEntry;
  score: number;
}

export function rankModels(models: ModelEntry[], profile: LanguageProfile, task: TaskType): RankedModel[] {
  return models
    .map((model) => {
      const languageFit = profile.modelScores[model.id] ?? UNKNOWN_LANGUAGE_SCORE;
      const taskFit = model.strengths.includes(task) ? 1 : 0;
      const quality = languageFit * (1 - TASK_WEIGHT) + taskFit * TASK_WEIGHT;
      // Paid models are discounted by their blended price per million tokens; free models are not
      const price = model.inputPricePerM + model.outputPricePerM;
      return { model, score: quality / (1 + price) };
    })
    .sort((a, b) => b.score - a.score);
}
