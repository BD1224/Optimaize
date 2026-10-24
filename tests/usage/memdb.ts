// In-memory database with the real schema applied, for tests.
import { openDatabase } from '../../src/main/db';
import type { UsageDb } from '../../src/main/usage/types';

export const openMemoryDb = (): UsageDb => openDatabase(':memory:');
