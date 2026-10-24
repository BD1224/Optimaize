# Project Structure

```
optimaize/
├── src/
│   ├── main/            # Electron main process: app startup, window creation, holds the API key
│   │   ├── ipc/         # Handlers the UI can call: send message, rerun on another model, weekly stats, save/check API key
│   │   ├── router/      # Picks the model for each message (algorithm TBD) and learns from the user's manual model choices
│   │   ├── providers/   # Anthropic Messages API client, streaming
│   │   ├── usage/       # Logs tokens per call; per-model pricing and cost on the biggest model
│   │   ├── context/     # Long chat -> summary -> fresh chat
│   │   ├── db/          # SQLite schema and access
│   │   └── security/    # Encrypted local API key storage
│   ├── preload/         # Bridge exposing a safe, typed API from main to the UI
│   ├── pages/           # React UI (Electron's "renderer"): chat, dashboard, settings, onboarding, token lessons, shared components
│   └── shared/          # Types used by main, preload, and pages
└── tests/               # Jest tests
```
