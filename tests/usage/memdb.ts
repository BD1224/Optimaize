// In-memory SQLite for tests. Swap for better-sqlite3 (`new Database(':memory:')`)
// once it is installed; the logger only needs exec/prepare/run/all.
import { DatabaseSync } from 'node:sqlite';
import type { UsageDb } from '../../src/main/usage/types';

export const openMemoryDb = (): UsageDb => new DatabaseSync(':memory:') as unknown as UsageDb;
