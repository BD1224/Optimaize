# Handoff: Person B, Tracking and Dashboard

## Project context (30 seconds)
Optimaize is an Electron + TypeScript + React desktop chat app for daily Claude users, especially non-English speakers who pay extra tokens because of the "language tax." The app routes each message to the cheapest capable model (Haiku, Sonnet or Opus), and your side makes the savings visible and trustworthy. Users bring their own API key, and everything is stored locally in SQLite. The renderer never touches the DB, the network or the key. It only calls typed IPC.

See `.kiro/steering/project.md` and `structure.md` for the full plan.

Another note (ignore if you read it already in `.kiro/steering/project.md`): For context, we are coding it 3 seperate ways meaning you need to code the skeleton or main idea of the project, and then later on we will circle back and route everything together. The last step should be very simple and only a matter of changing variables and such if things have gone smoothly. But I want you to keep this in mind going forward before you make any big permenetna changes that depend on the entire code 


## What you own
1. **Per-message token logging**, including what the same call would have cost on the biggest model.
2. **The energy estimate**, including the research behind the method.
3. **The weekly dashboard**: tokens saved, energy, and tips.

## Your files
| File | Status | Job |
|---|---|---|
| `src/main/usage/logger.ts` | stub | `record(usage)` writes a row and `getWeek()` aggregates rows |
| `src/main/usage/pricing.ts` | stub | per-model prices, and `cost(model, in, out)` and `baselineCost(in, out)` on the biggest model |
| `src/main/ipc/stats.ts` | stub | the `stats:weekly` handler |
| `src/main/db/schema.sql` | stub, shared | you own the `usage_log` table only |
| `src/shared/` | empty, shared | `UsageRecord` and `WeeklyStats` types, plus IPC channel names |
| `src/pages/` | empty | dashboard page and components. The page is unassigned, so confirm you own it. |
| `docs/energy-method.md` | doesn't exist | your research writeup (suggested path) |

Don't edit anything in `src/main/router/`. That's Person A's.

## Contract with Person A (agree before coding)
A's `sendMessage` calls your logger after every API call, and again after every Upgrade re-run. Proposed in `src/shared/usage.ts`:

```ts
export type ModelId = 'haiku' | 'sonnet' | 'opus';       // map to real API IDs in pricing.ts
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface UsageRecord {
  id: string;
  messageId: string;
  parentMessageId: string | null; // set on an upgrade re-run
  kind: 'chat' | 'classifier' | 'summary';  // classifier and summary calls are overhead
  model: ModelId;
  difficulty: Difficulty | null;
  inputTokens: number;            // use the API response's usage, not an estimate
  outputTokens: number;
  isUpgrade: boolean;
  language: string | null;        // lets you show the language tax later
  createdAt: number;              // epoch ms
}

export interface WeeklyStats {
  weekStart: number;
  tokensTotal: number;
  tokensBaseline: number;
  costActual: number;
  costBaseline: number;           // same calls priced on Opus
  costSaved: number;              // net: includes classifier, upgrade and summary overhead
  energyWhLow: number; energyWhHigh: number;   // range, not a point
  byModel: Record<ModelId, { calls: number; tokens: number }>;
  upgradeCount: number;
  tips: string[];
}
```

```sql
CREATE TABLE usage_log (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  parent_message_id TEXT,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  difficulty TEXT,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  is_upgrade INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_usage_created ON usage_log(created_at);
```

IPC channel: `stats:weekly` returns `WeeklyStats`, with an optional `weekStart` argument.

## Decisions to make early

1. **Savings must be net, not gross.** Gross savings is the baseline cost minus the chosen model's cost for the first attempt. Net savings also subtracts the classifier overhead, any upgrade re-run, and any summarization calls. Compute net and show the breakdown. An inflated number would undermine the project's "measured, honest" principle.
2. **What "baseline" means.** The baseline is the same input and output tokens priced on Opus. This is slightly generous, because a different model would produce a different output length. Label it as an estimate in the UI.
3. **Pricing.** Don't hardcode prices from memory. Get them from Anthropic's pricing page, put them in one table with a "last verified" date, and unit-test the cost math. Prices change.
4. **Real counts only.** Log `usage.input_tokens` and `usage.output_tokens` from the API response. Use Anthropic's token-counting endpoint if you need a count before sending.
5. **Energy estimate.** There's no official per-token energy figure for Claude models. A defensible approach:
   - Find published per-token or per-query energy measurements for LLM inference (for example the ML.Energy benchmark and similar work).
   - Pick a low and a high bound per model size class, and scale by tokens.
   - Show it as a range, with an "estimate" label and links to sources.
   - Write the method, assumptions and limits in `docs/energy-method.md`.
   - Make the coefficients config values, not magic numbers.
6. **Tips** should be rule-based to start. For example: "N% of your messages were easy but went to Sonnet," "you upgraded often on topic X," or "chats over N turns cost more, so try a reset." Each rule is a function over `WeeklyStats`, which makes it easy to test.

## Build order
1. Agree the types, table and IPC names with Person A, then commit them to `src/shared/` and `schema.sql`.
2. `pricing.ts` with unit tests (cost, baseline and the net-savings function).
3. `logger.ts`: `record()` and a weekly aggregation query, with tests against an in-memory SQLite.
4. `ipc/stats.ts` and the typed preload method.
5. Dashboard page against seeded fake data, so you aren't blocked on A. Write a seed script that generates a realistic week.
6. Swap fake data for real logs once A's `sendMessage` is wired.
7. Energy method doc and coefficients, then the tips rules.

## Dependencies and blockers
- **Needs from A:** the `Difficulty` and `ModelId` types, the call to `logger.record()` in `sendMessage` and `upgradeMessage`, and `kind: 'classifier'` logging for the classifier call.
- **Needs from whoever owns the app shell:** `db/index.ts` (SQLite connection), the preload bridge, and the UI scaffold and routing. These are still stubs or empty, so you may have to stub them yourself.
- **Needs from nobody:** pricing, the energy research and the dashboard components against seeded data.

## Definition of done
- Every API call produces exactly one `usage_log` row.
- The dashboard shows net tokens and cost saved, an energy range with sources, and at least three tips.
- Unit tests cover pricing, aggregation and the tip rules.
- All figures are labelled as estimates where they're estimates.

## Integration checklist (do these when wiring the tracks together)
1. ~~Write the DB layer~~ Done: `db/index.ts` opens SQLite (`node:sqlite`) and runs `db/schema.sql`.
2. ~~Move the table into `schema.sql`~~ Done: `usage/schema.ts` is deleted and the logger no longer creates its own table.
3. **If `node:sqlite` ever causes trouble,** swap to `better-sqlite3`: change the one line in `db/index.ts` that opens the database, add the package, and add the Electron rebuild step. Make sure `db/schema.sql` ships next to the bundled `db/index.js`.
4. **Wire the logger into `sendMessage`:** an adapter maps Person A's `usage.log({ chatId, model, difficulty, kind, usage })` onto `logger.record(...)` and returns `{ costUsd }`.
5. **Move shared types** out of `usage/types.ts` into `src/shared/` (reuse `Difficulty` from `shared/chat.ts`).
6. **Register `stats:weekly`** in the app shell and expose it through the preload bridge.
7. **Agree the `Stats` shape with the front end** and map `WeeklyStats` onto it.
8. **Re-verify prices** in `usage/pricing.ts` (last verified 2026-10-24) and the energy sources in `docs/energy-method.md`.
