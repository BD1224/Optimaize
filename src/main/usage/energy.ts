// Energy estimate. Method, sources and limits: docs/energy-method.md.
// Every number here is an estimate; Anthropic publishes no per-token figure for Claude.
import { BIGGEST_MODEL, finalAnswers } from './pricing';
import type { EnergyRange, ModelId, UsageRecord } from './types';

export interface EnergyCoefficients {
  lowWhPerOutputToken: number; // GPU-only, measured on an open model of similar size class
  highWhPerOutputToken: number; // low scaled by the full-stack overhead ratio
}

export interface EnergyConfig {
  perModel: Record<ModelId, EnergyCoefficients>;
  // Input tokens are ignored by default: the source measurements are per output token.
  inputTokenWeight: number;
}

// Anchors (see docs/energy-method.md):
//   70B-class:  0.04 Wh / ~361 output tokens = 1.11e-4 Wh/token  (ML.ENERGY v3.0)
//   405B-class: 0.21 Wh / ~367 output tokens = 5.72e-4 Wh/token  (ML.ENERGY v3.0)
//   Full-stack / chip-only ratio: 0.24 / 0.10 = 2.4              (Google, Gemini Apps)
// ASSUMPTION: haiku ~ 70B class, opus ~ 405B class, sonnet = geometric mean of the two.
// Claude's real sizes are not public, so this mapping is the weakest link.
const OVERHEAD = 2.4;
const LOW_SMALL = 0.04 / 361;
const LOW_LARGE = 0.21 / 367;
const LOW_MID = Math.sqrt(LOW_SMALL * LOW_LARGE);

export const DEFAULT_ENERGY: EnergyConfig = {
  perModel: {
    haiku: { lowWhPerOutputToken: LOW_SMALL, highWhPerOutputToken: LOW_SMALL * OVERHEAD },
    sonnet: { lowWhPerOutputToken: LOW_MID, highWhPerOutputToken: LOW_MID * OVERHEAD },
    opus: { lowWhPerOutputToken: LOW_LARGE, highWhPerOutputToken: LOW_LARGE * OVERHEAD },
  },
  inputTokenWeight: 0,
};

function whFor(model: ModelId, r: UsageRecord, cfg: EnergyConfig): EnergyRange {
  const c = cfg.perModel[model];
  const tokens = r.outputTokens + r.inputTokens * cfg.inputTokenWeight;
  return { low: tokens * c.lowWhPerOutputToken, high: tokens * c.highWhPerOutputToken };
}

// Energy actually used: every call, overhead included.
export function energyUsed(records: UsageRecord[], cfg: EnergyConfig = DEFAULT_ENERGY): EnergyRange {
  let low = 0;
  let high = 0;
  for (const r of records) {
    const e = whFor(r.model, r, cfg);
    low += e.low;
    high += e.high;
  }
  return { low, high };
}

// Energy saved vs. answering every message once on the biggest model. Each end of the
// range subtracts like from like (low-low, high-high), so low <= high always holds
// for the scenario, but the result can be negative.
export function energySaved(records: UsageRecord[], cfg: EnergyConfig = DEFAULT_ENERGY): EnergyRange {
  let low = 0;
  let high = 0;
  for (const a of finalAnswers(records)) {
    const e = whFor(BIGGEST_MODEL, a, cfg);
    low += e.low;
    high += e.high;
  }
  const used = energyUsed(records, cfg);
  return { low: low - used.low, high: high - used.high };
}
