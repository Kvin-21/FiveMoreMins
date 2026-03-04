import fs from 'fs';
import path from 'path';
import db from './connection';

export function runMigrations(): void {
  // The schema lives in src/db/ — resolve relative to CWD so it works whether
  // we're running ts-node-dev or the compiled dist.
  const schemaPath = path.resolve(process.cwd(), 'src', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Split on semicolons and execute each non-empty statement individually.
  // db.exec() handles multi-statement strings in SQLite, but splitting lets
  // us skip empty chunks from trailing semicolons without choking.
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    db.exec(statement + ';');
  }

  console.log(`✅ Migrations complete (${statements.length} statements)`);
}
