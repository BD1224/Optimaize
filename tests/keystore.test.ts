import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createKeystore, type SecretCrypto } from '../src/main/security/keystore';

// Reversible stand-in for Electron's safeStorage
const fakeCrypto = (available = true): SecretCrypto => ({
  isAvailable: () => available,
  encrypt: (s) => Buffer.from(s.split('').reverse().join('') + '!enc'),
  decrypt: (b) => b.toString().replace('!enc', '').split('').reverse().join(''),
});

describe('keystore', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(__dirname, '.tmp-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('round-trips a key and never writes it in plaintext', () => {
    const file = join(dir, 'key.bin');
    const ks = createKeystore(file, fakeCrypto());
    ks.save('  sk-secret  ');
    expect(ks.get()).toBe('sk-secret');
    expect(readFileSync(file).toString().includes('sk-secret')).toBe(false);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('reports no key before one is saved, and after clear', () => {
    const ks = createKeystore(join(dir, 'key.bin'), fakeCrypto());
    expect(ks.has()).toBe(false);
    ks.save('sk-1');
    expect(ks.has()).toBe(true);
    ks.clear();
    expect(ks.get()).toBeNull();
  });

  it('refuses to store when secure storage is unavailable', () => {
    const ks = createKeystore(join(dir, 'key.bin'), fakeCrypto(false));
    expect(() => ks.save('sk-1')).toThrow();
    expect(ks.has()).toBe(false);
  });

  it('rejects an empty key', () => {
    expect(() => createKeystore(join(dir, 'key.bin'), fakeCrypto()).save('   ')).toThrow();
  });

  it('treats an undecryptable file as no key', () => {
    const file = join(dir, 'key.bin');
    createKeystore(file, fakeCrypto()).save('sk-1');
    const broken: SecretCrypto = { ...fakeCrypto(), decrypt: () => { throw new Error('wrong user'); } };
    expect(createKeystore(file, broken).get()).toBeNull();
  });
});
