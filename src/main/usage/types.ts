// Person B's local types. At integration, move to src/shared/ and update imports.

export type ModelId = 'haiku' | 'sonnet' | 'opus';
export type Difficulty = 'easy' | 'medium' | 'hard';

// 'classifier' and 'summary' calls are overhead: they cost tokens but are not the answer.
export type UsageKind = 'chat' | 'classifier' | 'summary';

export interface UsageRecord {
  id: string;
  messageId: string;
  // Set on an Upgrade re-run; points at the ORIGINAL message's messageId.
  parentMessageId: string | null;
  kind: UsageKind;
  model: ModelId;
  difficulty: Difficulty | null;
  inputTokens: number; // from the API response's usage, never an estimate
  outputTokens: number;
  isUpgrade: boolean;
  language: string | null;
  createdAt: number; // epoch ms
}

// The subset of better-sqlite3 (and node:sqlite) that the logger needs.
// The DB handle is injected so this module doesn't depend on src/main/db.
export interface UsageDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
}

export interface EnergyRange {
  low: number;
  high: number;
}

export interface WeeklyStats {
  weekStart: number; // epoch ms, inclusive
  weekEnd: number; // epoch ms, exclusive
  tokensTotal: number; // input + output across every call, overhead included
  calls: number;
  baselineCost: number; // same answers priced on the biggest model
  actualCost: number;
  netSaved: number; // baselineCost - actualCost; can be negative
  upgradeCost: number;
  overheadCost: number;
  upgradeCount: number;
  byModel: Record<ModelId, { calls: number; tokens: number }>;
  // Estimated range, see docs/energy-method.md. Always an estimate, never a measurement.
  energyWh: EnergyRange;
  energySavedWh: EnergyRange; // vs. running every final answer on the biggest model
  tips: string[];
}
