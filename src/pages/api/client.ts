// The only module the UI uses to reach the backend. Components import `api` from here and nothing else.
//
// Inside the Electron app, the preload script puts the real backend on `window.api` (src/shared/api.ts) and every
// call below goes to it. In the browser preview (npm run preview) there is no `window.api`, so the in-memory
// mock answers instead.
//
// Log in and sign up still come from the mock: the backend has no accounts yet (see the notes in mock.ts).

import type { BackendApi } from "../../shared/api";
import * as mock from "./mock";

declare global {
  interface Window {
    api?: BackendApi;
  }
}

// The mock must keep the same call shapes as the real backend. This fails to compile if they drift apart.
const mockBackend: BackendApi = mock;

const backend: BackendApi = typeof window !== "undefined" && window.api ? window.api : mockBackend;
const usingRealBackend = backend !== mockBackend;

export const api = {
  ...mock,
  ...backend,
  // The mock's sign up also saved the name as the profile name. Do the same against the real backend.
  async signUp(input: Parameters<typeof mock.signUp>[0]) {
    const result = await mock.signUp(input);
    if (result.ok && usingRealBackend) await backend.updateProfile({ name: input.name.trim() });
    return result;
  },
};
