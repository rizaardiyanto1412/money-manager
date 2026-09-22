import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb } from './client.js';
import { getEnv } from '../env.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '../../drizzle');

export async function runMigrations(databaseUrl: string) {
  const { db, close } = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = getEnv();
  await runMigrations(env.DATABASE_URL);
  console.log('Migrations applied.');
}
