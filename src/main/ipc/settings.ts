// IPC handlers: saveApiKey, checkApiKey, getConfig, setConfig.
// The handlers are plain functions; registerSettingsHandlers only wires them to Electron.
import type { CheckApiKeyResult, ConfigPatch } from '../../shared/app';
import {
  SETTINGS_CHECK_API_KEY,
  SETTINGS_GET_CONFIG,
  SETTINGS_SAVE_API_KEY,
  SETTINGS_SET_CONFIG,
  type AppConfig,
} from '../../shared/app';
import type { ConfigStore } from '../db/settings';
import type { CheckKey } from '../providers/anthropic';
import type { Keystore } from '../security/keystore';

export interface SettingsDeps {
  keystore: Keystore;
  config: ConfigStore;
  checkKey: CheckKey;
}

export function createSettingsHandlers(deps: SettingsDeps) {
  return {
    saveApiKey(key: string): { ok: true } {
      if (typeof key !== 'string') throw new Error('API key must be a string');
      deps.keystore.save(key);
      return { ok: true };
    },
    // Checks the given key, or the saved one. Never returns the key itself.
    async checkApiKey(key?: string): Promise<CheckApiKeyResult> {
      const candidate = key ?? deps.keystore.get();
      if (!candidate) return { valid: false, error: 'No API key set' };
      return deps.checkKey(candidate);
    },
    getConfig: (): AppConfig => deps.config.get(),
    setConfig: (patch: ConfigPatch): AppConfig => deps.config.set(patch),
  };
}

// The slice of Electron's ipcMain this needs, so tests don't have to load Electron.
export interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: any[]) => unknown): void;
}

export function registerSettingsHandlers(ipcMain: IpcMainLike, deps: SettingsDeps): void {
  const h = createSettingsHandlers(deps);
  ipcMain.handle(SETTINGS_SAVE_API_KEY, (_e, key: string) => h.saveApiKey(key));
  ipcMain.handle(SETTINGS_CHECK_API_KEY, (_e, key?: string) => h.checkApiKey(key));
  ipcMain.handle(SETTINGS_GET_CONFIG, () => h.getConfig());
  ipcMain.handle(SETTINGS_SET_CONFIG, (_e, patch: ConfigPatch) => h.setConfig(patch));
}
