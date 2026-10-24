# Optimaize

A desktop chat app for daily Claude users that cuts wasted tokens and teaches users how tokens work.

## How it works

- **Router**: every message goes through a router that dispatches it to helpers.
- **Model picker**: chooses the cheapest model that can handle the message (Haiku for easy, Sonnet/Opus for hard).
- **Usage logger**: records tokens used and what the same call would have cost on the largest model.
- **Manual override**: the user can pick a model themselves (e.g. rerun an answer on a bigger model); the router learns from these choices for similar questions next time.
- Model selection and learning algorithms are TBD; decided during implementation.
- **Context reset**: when a chat gets too long, it's summarized and a fresh chat starts from the summary.
- **Weekly dashboard**: tokens saved and tips.

## Stack

- Electron + TypeScript, React renderer
- SQLite for local storage
- Electron Forge for build/packaging (no Vite), Jest for tests
- Users bring their own Anthropic API key, stored encrypted locally

## Layout

See `structure.md`.

- `src/main/` — Electron main process
  - `ipc/` — IPC handlers
  - `router/` — message routing to helpers
  - `providers/` — Claude API client
  - `usage/` — token/cost logging and dashboard stats
  - `context/` — summarization and chat resets
  - `db/` — SQLite access
  - `security/` — API key storage
- `src/preload/` — preload bridge exposing safe APIs to the renderer
- `src/pages/` — React UI
- `src/shared/` — types shared across main, preload, and renderer
- `tests/` — Jest tests

## Conventions

- Renderer never touches the API key, network, or DB directly; everything goes through IPC.
- Keep IPC contracts typed in `src/shared/`.

## Pivot
# Optimaize: Pivot Brief

## One-line pitch
A local desktop chat app for Claude that automatically cuts the extra token cost non-English speakers pay, without changing what their answers say.

## The problem: the "language tax"
Tokenizers split non-English text into more pieces than English text, so the same content costs more, fills the context window faster, and uses more energy.

- A September 2026 study reports that French costs 31% to 58% more tokens than English for the same content, and regional languages of France cost about double. ([arXiv](https://arxiv.org/html/2609.39001v1))
- Under GPT-4's tokenizer, Indian languages average an 8.0x token cost relative to English, reaching 13.0x for Malayalam. That shrinks the effective context window to as little as 12% of an English user's. ([arXiv](https://arxiv.org/abs/2607.24276))
- A position paper argues the effects stack: higher cost, weaker reasoning as sequences inflate, and a disproportionate environmental cost. ([Zenodo](https://zenodo.org/records/20028344))
- A July 2026 paper finds the underlying content differs by under 6%, so the tax is representational, not informational. ([arXiv](https://arxiv.org/pdf/2609.00378))

Note: these figures come from outside papers, and the GPT-4 number does not necessarily apply to Claude's tokenizer. Verify before using them publicly (see Open questions).

## What the product does
Optimaize reduces the tokens users spend in their own language. It applies the savings automatically, with no extra steps for the user.

1. **Language detection and measurement.** Detect the chat's language and measure real token usage per message, so the app knows where the extra tokens go.
2. **Automatic token-saving techniques.** Applied by default to every message:
   - Keep the app's own instructions and system prompts in English while the user writes and reads in their own language.
   - Trim bulky prompts and replies (wording, formatting, repeated context).
   - Summarize long chats and start a fresh one, so old context isn't re-sent at a language-inflated price.
3. **Config-driven.** Each technique is controlled by a config file with an on/off flag, all on by default. This keeps behavior consistent now and makes a settings screen easy to add later.
4. **Smart routing.** Send easy questions to cheaper models, with an "Upgrade" button for a better answer. The app learns which kinds of questions need more power.
5. **Teaching.** Short, in-app explanations of why some languages use more tokens and how the app reduces it.

### Example config
```json
{
  "languageSavings": {
    "englishSystemPrompts": true,
    "promptTrimming": true,
    "autoSummarizeLongChats": true,
    "translateThroughEnglish": false
  },
  "routing": {
    "enabled": true
  }
}
```

`translateThroughEnglish` (translate to English, get the answer, translate back) is the one technique that can lose meaning, so it stays off by default and is only turned on deliberately.

## Target users
- Primary: people who use Claude daily in a non-English language and pay per token (freelancers, small teams, students on API keys).
- Niche option: healthcare-adjacent use, such as patient-facing questions in Spanish, Portuguese, or Haitian Creole. This needs extra care on accuracy, so any technique that could change meaning should stay off.

## Why it's different
- It is a finished consumer app, not developer infrastructure like OpenRouter, Martian, or LiteLLM.
- It targets a specific, underserved problem (the language tax), not generic cost savings.
- It is local-first: the API key stays in the OS keychain and calls go straight to Anthropic.

## Principles
- Savings run automatically, but any technique that could affect meaning is off by default.
- No prompts or keys ever leave the user's machine.
- Savings claims must be measured on Claude's own tokenizer, not borrowed from other models' numbers.

## Open questions
- How big is the language tax on Claude's tokenizer for the target languages? Measure it with Anthropic's token counting before building anything else.
- Which techniques actually reduce tokens by a meaningful amount without hurting quality?
- Which languages and which user group do we launch with?
- How do we show the savings honestly, such as cost versus the user's default setup, not an inflated "biggest model" baseline?