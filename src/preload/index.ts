// The bridge between the UI (src/pages) and the main process (src/main).
// Exposes a small typed window.api; the renderer never sees the API key or the network.
import { contextBridge, ipcRenderer } from 'electron';
import {
  SETTINGS_CHECK_API_KEY,
  SETTINGS_GET_CONFIG,
  SETTINGS_SAVE_API_KEY,
  SETTINGS_SET_CONFIG,
  STATS_WEEKLY,
  type OptimaizeApi,
} from '../shared/app';
import { CHAT_SEND, CHAT_TOKEN, CHAT_UPGRADE, type TokenEvent } from '../shared/chat';

const api: OptimaizeApi = {
  sendMessage: (req) => ipcRenderer.invoke(CHAT_SEND, req),
  upgradeMessage: (req) => ipcRenderer.invoke(CHAT_UPGRADE, req),
  onToken: (listener) => {
    const wrapped = (_event: unknown, payload: TokenEvent) => listener(payload);
    ipcRenderer.on(CHAT_TOKEN, wrapped);
    return () => ipcRenderer.removeListener(CHAT_TOKEN, wrapped);
  },
  getWeeklyStats: () => ipcRenderer.invoke(STATS_WEEKLY),
  saveApiKey: (key) => ipcRenderer.invoke(SETTINGS_SAVE_API_KEY, key),
  checkApiKey: (key) => ipcRenderer.invoke(SETTINGS_CHECK_API_KEY, key),
  getConfig: () => ipcRenderer.invoke(SETTINGS_GET_CONFIG),
  setConfig: (patch) => ipcRenderer.invoke(SETTINGS_SET_CONFIG, patch),
};

contextBridge.exposeInMainWorld('api', api);
