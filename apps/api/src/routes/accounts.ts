import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
import { createAccountSchema, updateAccountSchema } from '@money-manager/shared';
import { accounts, transactions } from '../db/schema.js';

/** balance = initial + income + transfers-in - expenses - transfers-out.
 * Correlated refs use literal qualified names: drizzle emits embedded
 * column objects unqualified, which would bind to the inner subquery. */
const balanceSql = sql<number>`(
  ${accounts.initialBalanceMinor}
  + coalesce((select sum(t.amount_minor) from ${transactions} t
      where t.account_id = accounts.id and t.type = 'income'), 0)
  - coalesce((select sum(t.amount_minor) from ${transactions} t
      where t.account_id = accounts.id and t.type = 'expense'), 0)
  + coalesce((select sum(t.amount_minor) from ${transactions} t
      where t.to_account_id = accounts.id and t.type = 'transfer'), 0)
  - coalesce((select sum(t.amount_minor) from ${transactions} t
      where t.account_id = accounts.id and t.type = 'transfer'), 0)
)`;

export const accountsRoutes = new Hono()
  .get('/', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const rows = await db
      .select({
        id: accounts.id,
        userId: accounts.userId,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        balanceMinor: balanceSql.mapWith(Number),
        settlementDay: accounts.settlementDay,
        icon: accounts.icon,
        sortOrder: accounts.sortOrder,
        archived: accounts.archived,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.sortOrder, accounts.createdAt);
    return c.json({ accounts: rows });
  })
  .post('/', zValidator('json', createAccountSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const input = c.req.valid('json');
    const [row] = await db
      .insert(accounts)
      .values({ ...input, userId, currency: input.currency ?? 'IDR' })
      .returning();
    return c.json({ account: { ...row, balanceMinor: row!.initialBalanceMinor } }, 201);
  })
  .patch('/:id', zValidator('json', updateAccountSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const [row] = await db
      .update(accounts)
      .set(input)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Account not found' }, 404);
    return c.json({ account: row });
  })
  .delete('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const [row] = await db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning({ id: accounts.id });
    if (!row) return c.json({ error: 'Account not found' }, 404);
    return c.json({ ok: true });
  });
