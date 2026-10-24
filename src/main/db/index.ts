// SQLite access layer (node:sqlite, built into Node; no native module to rebuild).
// Callers get a plain database handle; the small repositories below sit on top of it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

// Opens (creating if needed) the database at `file`, or in memory for ':memory:', and
// applies db/schema.sql. The schema file must ship next to this module in the build.
export function openDatabase(file: string = ':memory:'): Db {
  const db = new DatabaseSync(file);
  db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}
