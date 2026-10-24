// The only module the UI uses to reach the backend. Components import `api` from here and nothing else.
// Today it forwards to the in-memory mock. Once the backend's IPC handlers exist, it calls the `window.api`
// bridge from src/preload instead, and only this file changes.

import * as backend from "./mock";

export const api = backend;
