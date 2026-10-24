# Backend design: language-aware routing on OpenRouter

Scope: `src/main/` only. `src/pages/` (UI) is out of scope here. To the user this is a regular chatbot; everything below happens in the background.

## Core idea

Non-English text costs more tokens, and models differ in how well they handle each language. We use OpenRouter as the single gateway to many models, and add our own language logic in front of it:

1. Detect the message language and task.
2. Narrow the full model catalog to a small pool of models that are strong in that language and affordable for it.
3. Hand that pool to OpenRouter's auto router (`openrouter/auto`), which picks within the pool.
4. If the user picked a model manually, skip all of the above and send that exact model.

## Request flow

```
renderer -> preload -> ipc/chat.ts -> backend -> OpenRouter -> full reply back
```

1. `chat:send` arrives with `{ chatId, text, modelOverride? }`.
2. If `modelOverride` is set, jump to step 7 with that model ID.
3. `language/detect` identifies the language.
4. `router/classifier` assigns a task type and difficulty (cheap heuristics first; an LLM call is an open question).
5. `router/policy` scores candidates from the model registry using language fit, task fit, and estimated token cost for that language, and returns a pool of a few models.
6. `context/` shrinks the history if the chat is long (summarize and reset, drop bulky repeated content).
7. `providers/openrouter` sends the request: `openrouter/auto` restricted to the pool (or the explicit override model), with the fixed English system prompt, and returns the full reply over IPC (no streaming in v1).
8. `usage/logger` records the real token counts and cost from the response.
9. `router/feedback` records manual overrides as a signal that the pool was wrong for this language and task.

## Decisions

- **Router picks the pool; OpenRouter picks within it.** OpenRouter's auto router knows nothing about languages, so our logic constrains it rather than replacing it.
- **Allowed-models option is unverified.** As far as we know the auto router can be restricted with an allowed-models list (believed to be `allowed_models`, with wildcard patterns). Check the current OpenRouter docs before building on the exact name. Fallback plan: pick one model ourselves and send an explicit ID plus fallbacks.
- **Manual override stays.** The user may choose a specific model for any message. This also covers "regenerate with another model" as the same code path.
- **No separate rerun/upgrade flow.** Dropped. A retry on another model is just an override on the last message. It is logged as a retry so cost stats stay honest, and it feeds `feedback.ts`.
- **System prompt is always English.** We write it, so it is a fixed constant in `prompts/`, not a pipeline step. It tells the model to reply in the user's language.
- **Context trimming is ours, not OpenRouter's.** APIs are stateless, so the whole history is resent every turn. OpenRouter's `middle-out` transform only helps on context overflow, so keep it only as a last-resort safety net. Our `context/` module summarizes old turns, which matters most for non-English history.
- **Provider/host routing is ignored for now.** It only chooses which host serves a model already chosen. Not part of this design.
- **Model knowledge is data, not code.** Model registry and language strengths live in editable JSON under `config/`, so retuning does not touch logic.
- **No prompts or keys leave the machine** except to OpenRouter. The renderer never touches the key, network, or DB.

## Modules

| Path | Job |
|---|---|
| `ipc/chat.ts` | `chat:send`, `chat:cancel`; validates input, calls the router, returns the full reply |
| `ipc/settings.ts` | save/check the OpenRouter key; user prefs and default overrides |
| `ipc/stats.ts` | `stats:weekly` (if the usage dashboard is kept) |
| `providers/openrouter.ts` | one OpenRouter client (non-streaming): pool/auto or explicit model, usage parsing |
| `language/detect.ts` | detect the language of a message |
| `language/profiles.ts` | per-language data: which models are strong, token-cost multiplier |
| `language/tokenCost.ts` | estimate tokens per model/tokenizer for a given text |
| `router/index.ts` | orchestrates detect -> classify -> pool |
| `router/classifier.ts` | task type and difficulty |
| `router/policy.ts` | scores candidates and returns the pool |
| `router/feedback.ts` | learns from manual overrides |
| `context/summarizer.ts` | summarize long chats and start a fresh one from the summary |
| `prompts/system.ts` | fixed English system prompt |
| `usage/logger.ts`, `usage/pricing.ts` | per-call token and cost logging; OpenRouter reports cost per generation |
| `db/` | SQLite: chats, messages, summaries, usage log, override feedback; lets the app reference previous questions and responses |
| `security/keystore.ts` | encrypted local storage of the OpenRouter key |
| `src/shared/` | typed IPC contracts: channels, `ChatRequest`, `ChatChunk`, `UsageRecord`, config |
| `config/models.json`, `config/languages.json` | model registry and language-to-model strengths |

## Config

```json
{
  "languageSavings": {
    "contextSummarization": true,
    "translateThroughEnglish": false
  },
  "routing": {
    "enabled": true,
    "mode": "pool-auto"
  }
}
```

`translateThroughEnglish` is kept as an optional user setting, off by default (translate prompt to English, ask, translate back). It is the one technique that can change meaning, so it stays off for healthcare-adjacent use. Lives in `pipeline/translate.ts`; the translator choice (local vs. via a model) is still to be decided.

## More decisions

- **Any provider on OpenRouter** (Claude, GPT, Gemini, Llama, Qwen, DeepSeek, ...), not Anthropic only.
- **Language strengths come from a researched data file** (`config/languages.json`): which models/providers are better for which languages (training-data language coverage, published multilingual benchmarks). Built from web research, with sources noted in the file, and refined with our own tests.
- **Classifier is pure heuristics** (no LLM call), so routing costs zero tokens.
- **Usage logging kept**: real token counts per call, plus a token baseline (the same call on the most expensive model in the pool). Real data comes from tests we run. No energy estimate. No dollar-savings claims.
- **Nothing ported from other branches** except the shape of Simon's `UsageRecord` / `usage_log` (handoff-person-b.md), adapted: drop `isUpgrade`/`parentMessageId` upgrade semantics, keep a retry flag, drop energy fields.

## Settled

- No streaming in v1: the full reply is returned at once. Revisit later.
- SQLite stays, so the app can reference previous questions and responses.
- Free models first: v1 uses OpenRouter `:free` models, but the code must work unchanged with paid models (user supplies their own OpenRouter API key). Free-only means no dollar savings claims; paid use makes cost figures meaningful.
- No testing yet: get a working end-to-end version first, add Jest later.

## Open questions

- Tooling: set up `package.json` and `tsconfig` on this branch (reusable from Simon's/Benny's branches).
