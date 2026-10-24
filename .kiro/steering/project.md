# Optimaize

A desktop chat app that behaves like a regular chatbot, while the backend quietly picks the most efficient, best-qualified model for the user's language and message.

## One-line pitch
A local desktop chatbot that routes each message through OpenRouter to the models best suited to the user's language, cutting the extra token cost non-English speakers pay, without changing what their answers say.

## The problem: the "language tax"
Tokenizers split non-English text into more pieces than English text, so the same content costs more, fills the context window faster, and uses more energy. Models also differ in how well they handle each language.

- A September 2026 study reports that French costs 31% to 58% more tokens than English for the same content, and regional languages of France cost about double. ([arXiv](https://arxiv.org/html/2609.39001v1))
- Under GPT-4's tokenizer, Indian languages average an 8.0x token cost relative to English, reaching 13.0x for Malayalam. ([arXiv](https://arxiv.org/abs/2607.24276))
- A July 2026 paper finds the underlying content differs by under 6%, so the tax is representational, not informational. ([arXiv](https://arxiv.org/pdf/2609.00378))

Note: these figures come from outside papers and are tokenizer-specific. Measure on the tokenizers of the models we actually route to before using them publicly.

## How it works

The frontend sends a message, calls a function in `src/main/ipc/`, and the backend does the rest. See `docs/backend-design.md` for the full design.

- **OpenRouter is the gateway** to all models; the user brings an OpenRouter API key.
- **Language-aware router**: detects language and task, then narrows the model catalog to a small pool of models that are strong in that language and affordable for it.
- **OpenRouter auto picks within the pool**: our logic constrains `openrouter/auto` instead of replacing it. (Exact option for restricting the pool must be verified in OpenRouter's docs; fallback is an explicit pick plus fallbacks.)
- **Manual override**: the user may pick a specific model for any message, including regenerating the last answer on another model. This is the only "retry" mechanism; there is no separate rerun flow. Overrides feed the router's learning.
- **English system prompt**: always a fixed English constant telling the model to reply in the user's language.
- **Context management**: long chats are summarized and a fresh chat starts from the summary, so old non-English history isn't resent at a language-inflated price. OpenRouter's `middle-out` is only a last-resort safety net.
- **Usage logging**: real token counts and cost from each response.

`translateThroughEnglish` is the one technique that can lose meaning, so it stays off by default (and off for healthcare-adjacent use).

## Target users
- Primary: people who use LLMs daily in a non-English language and pay per token (freelancers, small teams, students on API keys).
- Niche option: healthcare-adjacent use in Spanish, Portuguese, or Haitian Creole; any meaning-altering technique stays off.

## Stack

- Electron + TypeScript, React renderer
- SQLite for local storage
- Electron Forge for build/packaging (no Vite); tests (Jest) deferred until something works end to end
- OpenRouter API, user's key stored encrypted locally; free (`:free`) models first, but paid models must work too

## Layout

See `structure.md`. Work in this phase is backend only (`src/main/`); `src/pages/` is frontend and out of scope.

## Conventions

- Renderer never touches the API key, network, or DB directly; everything goes through IPC.
- Keep IPC contracts typed in `src/shared/`.
- Model and language knowledge lives in JSON under `config/`, not in code.

## Principles
- Savings run automatically, but any technique that could affect meaning is off by default.
- No prompts or keys leave the user's machine except to OpenRouter.
- Savings claims must be measured, not borrowed from other models' numbers.

## Open questions
See the end of `docs/backend-design.md`.
