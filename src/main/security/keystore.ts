// OS keychain integration for encrypted local API key storage.
// The encryption itself is injected (Electron's safeStorage in the app), so this is testable.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SecretCrypto {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

export interface Keystore {
  save(key: string): void;
  get(): string | null;
  has(): boolean;
  clear(): void;
}

export function createKeystore(file: string, crypto: SecretCrypto): Keystore {
  return {
    save(key) {
      const trimmed = key.trim();
      if (!trimmed) throw new Error('API key is empty');
      // Never fall back to plaintext on disk
      if (!crypto.isAvailable()) throw new Error('Secure storage is not available on this system');
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, crypto.encrypt(trimmed), { mode: 0o600 });
      chmodSync(file, 0o600);
    },
    get() {
      if (!existsSync(file) || !crypto.isAvailable()) return null;
      try {
        return crypto.decrypt(readFileSync(file));
      } catch {
        return null; // unreadable or from another machine/user: treat as not set
      }
    },
    has() {
      return this.get() !== null;
    },
    clear() {
      rmSync(file, { force: true });
    },
  };
}
