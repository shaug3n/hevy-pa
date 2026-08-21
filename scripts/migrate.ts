import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
  const sql = neon(connectionString);
  const migrationsDirectory = path.join(process.cwd(), 'scripts', 'migrations');
  const migrations = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

  for (const name of migrations) {
    const alreadyApplied = await sql`SELECT name FROM schema_migrations WHERE name = ${name}`;
    if (alreadyApplied.length) continue;
    const migration = await readFile(path.join(migrationsDirectory, name), 'utf8');
    const statements = migration.split(';').map((statement) => statement.trim()).filter(Boolean);
    await sql.transaction((transaction) => [
      ...statements.map((statement) => transaction.query(statement)),
      transaction`INSERT INTO schema_migrations (name) VALUES (${name})`,
    ]);
    console.log(`Applied ${name}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Migration failed.');
  process.exitCode = 1;
});
