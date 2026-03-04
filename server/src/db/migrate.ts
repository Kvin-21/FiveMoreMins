import fs from 'fs';
import path from 'path';
import db from './connection';

export function runMigrations(): void {
  // The schema lives in src/db/ — resolve relative to CWD so it works whether
  // we're running ts-node-dev or the compiled dist.
  const schemaPath = path.resolve(process.cwd(), 'src', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Execute the entire schema in one shot. SQLite's db.exec() handles
  // multi-statement strings fine, and this avoids any issues with
  // semicolons appearing inside SQL string literals or comments.
  db.exec(schema);

  console.log('✅ Migrations complete');
}
