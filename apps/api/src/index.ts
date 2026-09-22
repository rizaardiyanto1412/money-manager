import { serve } from '@hono/node-server';
import { getEnv } from './env.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';

const env = getEnv();

await runMigrations(env.DATABASE_URL);
const { db } = createDb(env.DATABASE_URL);
const app = createApp({ env, db });

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`money-manager-api listening on :${info.port}`);
});
