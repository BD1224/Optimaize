// The bridge between the UI (src/pages) and the main process (src/main).
// Exposes window.api with the calls in shared/api.ts. The renderer never sees the API key or the network.
import { contextBridge, ipcRenderer } from 'electron';
import { BACKEND_METHODS, backendChannel, type BackendApi } from '../shared/api';

const api = Object.fromEntries(
  BACKEND_METHODS.map((method) => [method, (...args: unknown[]) => ipcRenderer.invoke(backendChannel(method), ...args)]),
) as unknown as BackendApi;

contextBridge.exposeInMainWorld('api', api);
