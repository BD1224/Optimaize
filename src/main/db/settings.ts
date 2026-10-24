// App config stored as JSON in the settings table; missing keys fall back to defaults.
import { DEFAULT_CONFIG, type AppConfig, type ConfigPatch } from '../../shared/app';
import type { Profile } from '../../shared/types';
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

// The user's profile (name, languages, display preferences), also stored as JSON.
const DEFAULT_PROFILE: Profile = {
  name: 'there',
  plan: 'Free',
  languages: ['en'],
  translateByDefault: false,
  showSentAs: false,
};

export interface ProfileStore {
  get(): Profile;
  set(patch: Partial<Profile>): Profile;
}

export function createProfileStore(db: Db): ProfileStore {
  const select = db.prepare('SELECT value FROM settings WHERE key = ?');
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );

  const get = (): Profile => {
    const row = select.get('profile') as { value: string } | undefined;
    if (!row) return DEFAULT_PROFILE;
    try {
      return { ...DEFAULT_PROFILE, ...(JSON.parse(row.value) as Partial<Profile>) };
    } catch {
      return DEFAULT_PROFILE;
    }
  };

  return {
    get,
    set(patch) {
      const next = { ...get(), ...patch };
      upsert.run('profile', JSON.stringify(next));
      return next;
    },
  };
}
