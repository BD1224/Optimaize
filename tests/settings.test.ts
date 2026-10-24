import { DEFAULT_CONFIG } from '../src/shared/app';
import { openDatabase } from '../src/main/db';
import { createConfigStore } from '../src/main/db/settings';
import { createSettingsHandlers } from '../src/main/ipc/settings';
import { createCheckKey } from '../src/main/providers/anthropic';
import type { Keystore } from '../src/main/security/keystore';

function memKeystore(initial: string | null = null): Keystore {
  let key = initial;
  return { save: (k) => { key = k.trim(); }, get: () => key, has: () => key !== null, clear: () => { key = null; } };
}

describe('config store', () => {
  it('returns the defaults, with translateThroughEnglish off', () => {
    const cfg = createConfigStore(openDatabase()).get();
    expect(cfg).toEqual(DEFAULT_CONFIG);
    expect(cfg.languageSavings.translateThroughEnglish).toBe(false);
  });

  it('merges partial updates and keeps the rest', () => {
    const store = createConfigStore(openDatabase());
    store.set({ languageSavings: { promptTrimming: false } });
    const cfg = store.set({ routing: { enabled: false } });
    expect(cfg.languageSavings.promptTrimming).toBe(false);
    expect(cfg.languageSavings.autoSummarizeLongChats).toBe(true);
    expect(cfg.routing.enabled).toBe(false);
    expect(store.get()).toEqual(cfg);
  });

  it('falls back to defaults if the stored value is corrupt', () => {
    const db = openDatabase();
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('config', '{not json');
    expect(createConfigStore(db).get()).toEqual(DEFAULT_CONFIG);
  });
});

describe('settings handlers', () => {
  const make = (ks = memKeystore(), valid = true) => {
    const checked: string[] = [];
    const h = createSettingsHandlers({
      keystore: ks,
      config: createConfigStore(openDatabase()),
      checkKey: async (k) => { checked.push(k); return valid ? { valid: true } : { valid: false, error: 'bad' }; },
    });
    return { h, ks, checked };
  };

  it('saves a key without ever returning it', () => {
    const { h, ks } = make();
    expect(h.saveApiKey('sk-1')).toEqual({ ok: true });
    expect(ks.get()).toBe('sk-1');
  });

  it('checks the given key, or else the saved one', async () => {
    const { h, checked } = make(memKeystore('sk-saved'));
    await h.checkApiKey('sk-new');
    await h.checkApiKey();
    expect(checked).toEqual(['sk-new', 'sk-saved']);
  });

  it('says so when there is no key to check', async () => {
    const { h, checked } = make();
    expect(await h.checkApiKey()).toEqual({ valid: false, error: 'No API key set' });
    expect(checked).toEqual([]);
  });

  it('rejects a non-string key', () => {
    expect(() => make().h.saveApiKey(42 as never)).toThrow();
  });
});

describe('createCheckKey', () => {
  const client = (err?: unknown) => ({ messages: { countTokens: async () => { if (err) throw err; return {}; } } });

  it('accepts a working key', async () => {
    expect(await createCheckKey(() => client())('sk')).toEqual({ valid: true });
  });
  it('marks a rejected key invalid', async () => {
    const r = await createCheckKey(() => client({ status: 401 }))('sk');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('rejected');
  });
  it('does not blame the key for network trouble', async () => {
    const r = await createCheckKey(() => client(new Error('ENOTFOUND')))('sk');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Could not reach');
  });
});
