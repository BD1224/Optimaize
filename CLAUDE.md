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
