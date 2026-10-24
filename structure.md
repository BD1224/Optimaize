# Project Structure

```
optimaize/
├── config/              # Editable data: models.json (model registry), languages.json (language -> strong models, token-cost multipliers)
├── docs/                # backend-design.md: flow, decisions, open questions
├── src/
│   ├── main/            # Electron main process (the backend; current focus)
│   │   ├── ipc/         # Thin handlers the UI calls: chat:send, chat:cancel, settings, stats
│   │   ├── providers/   # openrouter.ts: single OpenRouter client (non-streaming), usage parsing
│   │   ├── language/    # detect.ts, profiles.ts (per-language model strengths), tokenCost.ts
│   │   ├── router/      # index.ts, classifier.ts, policy.ts (builds the model pool), feedback.ts (learns from overrides)
│   │   ├── context/     # Summarize long chats and start fresh from the summary
│   │   ├── pipeline/    # Optional settings-driven steps; translate.ts (translateThroughEnglish, off by default)
│   │   ├── prompts/     # Fixed English system prompt
│   │   ├── usage/       # Per-call token and cost logging
│   │   ├── db/          # SQLite schema and access
│   │   └── security/    # Encrypted local OpenRouter key storage
│   ├── preload/         # Bridge exposing a safe, typed API from main to the UI
│   ├── pages/           # React UI (frontend, out of scope for backend work)
│   └── shared/          # Typed IPC channels and shared types (ChatRequest, ChatChunk, UsageRecord, config)
└── tests/               # Jest tests
```
