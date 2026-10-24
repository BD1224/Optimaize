// SQLite access layer (node:sqlite, built into Node; no native module to rebuild).
// Callers get a plain database handle; the small repositories below sit on top of it.
import { DatabaseSync } from 'node:sqlite';
import schema from './schema.sql';

export type Db = DatabaseSync;

// Opens (creating if needed) the database at `file`, or in memory for ':memory:', and
// applies db/schema.sql (bundled in as a string by webpack, and by tests/sqlTransform.js in Jest).
export function openDatabase(file: string = ':memory:'): Db {
  const db = new DatabaseSync(file);
  db.exec(schema);
  return db;
}
