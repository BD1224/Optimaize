// The only module the UI uses to reach the backend. Components import `api` from here and nothing else.
// Today it forwards to the in-memory mock. Later it calls the real backend (Supabase / route handlers),
// and only this file changes.

import * as backend from "./mock";

export const api = backend;
