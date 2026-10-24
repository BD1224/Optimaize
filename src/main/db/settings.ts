// App config stored as JSON in the settings table; missing keys fall back to defaults.
import { DEFAULT_CONFIG, type AppConfig, type ConfigPatch } from '../../shared/app';
import type { Db } from './index';

export interface ConfigStore {
  get(): AppConfig;
  set(patch: ConfigPatch): AppConfig;
}

const KEY = 'config';

function merge(base: AppConfig, patch: ConfigPatch): AppConfig {
  return {
    languageSavings: { ...base.languageSavings, ...patch.languageSavings },
    routing: { ...base.routing, ...patch.routing },
  };
}

export function createConfigStore(db: Db): ConfigStore {
  const select = db.prepare('SELECT value FROM settings WHERE key = ?');
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );

  const get = (): AppConfig => {
    const row = select.get(KEY) as { value: string } | undefined;
    if (!row) return DEFAULT_CONFIG;
    try {
      return merge(DEFAULT_CONFIG, JSON.parse(row.value) as ConfigPatch);
    } catch {
      return DEFAULT_CONFIG; // corrupted setting: fall back rather than crash on startup
    }
  };

  return {
    get,
    set(patch) {
      const next = merge(get(), patch);
      upsert.run(KEY, JSON.stringify(next));
      return next;
    },
  };
}
