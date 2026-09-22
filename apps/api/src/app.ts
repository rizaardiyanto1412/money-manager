import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import type { Env } from './env.js';
import type { Database } from './db/client.js';
import { eq } from 'drizzle-orm';
import { users } from './db/schema.js';
import { authMiddleware } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { accountsRoutes } from './routes/accounts.js';
import { categoriesRoutes } from './routes/categories.js';
import { transactionsRoutes } from './routes/transactions.js';
import { budgetsRoutes } from './routes/budgets.js';
import { statsRoutes } from './routes/stats.js';
import { apiKeysRoutes } from './routes/apikeys.js';
import { recurringRoutes } from './routes/recurring.js';
import { bookmarksRoutes } from './routes/bookmarks.js';
import { importRoutes } from './routes/import.js';

export interface AppDeps {
  env: Env;
  db: Database;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.use(
    '*',
    createMiddleware(async (c, next) => {
      c.set('db', deps.db);
      c.set('env', deps.env);
      return next();
    }),
  );
  app.use('/api/*', cors());

  app.get('/api/health', (c) => c.json({ ok: true, service: 'money-manager-api' }));

  const authed = new Hono();
  authed.use('*', authMiddleware());
  authed.route('/accounts', accountsRoutes);
  authed.route('/categories', categoriesRoutes);
  authed.route('/transactions', transactionsRoutes);
  authed.route('/budgets', budgetsRoutes);
  authed.route('/stats', statsRoutes);
  authed.route('/api-keys', apiKeysRoutes);
  authed.route('/recurring', recurringRoutes);
  authed.route('/bookmarks', bookmarksRoutes);
  authed.route('/import', importRoutes);
  authed.get('/me', async (c) => {
    const { userId } = c.get('auth');
    const [user] = await c
      .get('db')
      .select({ id: users.id, email: users.email, name: users.name, currency: users.currency, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ user });
  });

  app.route('/api/auth', authRoutes);
  app.route('/api', authed);

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
