import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from '@money-manager/shared';
import { accounts, categories, transactions } from '../db/schema.js';
import type { Database } from '../db/client.js';

async function validateRefs(
  db: Database,
  userId: string,
  input: { accountId?: string; toAccountId?: string | null; categoryId?: string | null },
) {
  if (input.accountId) {
    const [a] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!a) return 'accountId does not belong to you';
  }
  if (input.toAccountId) {
    const [a] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, input.toAccountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!a) return 'toAccountId does not belong to you';
  }
  if (input.categoryId) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!cat) return 'categoryId does not belong to you';
  }
  return null;
}

export const transactionsRoutes = new Hono()
  .get('/', zValidator('query', listTransactionsQuerySchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const q = c.req.valid('query');

    const filters: SQL[] = [eq(transactions.userId, userId)];
    if (q.from) filters.push(gte(transactions.date, q.from));
    if (q.to) filters.push(lte(transactions.date, q.to));
    if (q.type) filters.push(eq(transactions.type, q.type));
    if (q.accountId) {
      filters.push(
        or(eq(transactions.accountId, q.accountId), eq(transactions.toAccountId, q.accountId))!,
      );
    }
    if (q.categoryId) filters.push(eq(transactions.categoryId, q.categoryId));
    if (q.q) filters.push(ilike(transactions.memo, `%${q.q}%`));

    const rows = await db
      .select()
      .from(transactions)
      .where(and(...filters))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(q.limit)
      .offset(q.offset);
    return c.json({ transactions: rows, limit: q.limit, offset: q.offset });
  })
  .post('/', zValidator('json', createTransactionSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const input = c.req.valid('json');

    const refError = await validateRefs(db, userId, input);
    if (refError) return c.json({ error: refError }, 400);

    const [row] = await db.insert(transactions).values({ ...input, userId }).returning();
    return c.json({ transaction: row }, 201);
  })
  .get('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, c.req.param('id')), eq(transactions.userId, userId)))
      .limit(1);
    if (!row) return c.json({ error: 'Transaction not found' }, 404);
    return c.json({ transaction: row });
  })
  .patch('/:id', zValidator('json', updateTransactionSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1);
    if (!existing) return c.json({ error: 'Transaction not found' }, 404);

    const merged = { ...existing, ...input };
    const refError = await validateRefs(db, userId, merged);
    if (refError) return c.json({ error: refError }, 400);
    if (merged.type === 'transfer' && !merged.toAccountId) {
      return c.json({ error: 'toAccountId is required for transfers' }, 400);
    }
    if (merged.type === 'transfer' && merged.toAccountId === merged.accountId) {
      return c.json({ error: 'Cannot transfer to the same account' }, 400);
    }
    if (merged.type !== 'transfer' && !merged.categoryId) {
      return c.json({ error: 'categoryId is required for income/expense' }, 400);
    }

    const [row] = await db
      .update(transactions)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return c.json({ transaction: row });
  })
  .delete('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .delete(transactions)
      .where(and(eq(transactions.id, c.req.param('id')), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });
    if (!row) return c.json({ error: 'Transaction not found' }, 404);
    return c.json({ ok: true });
  });
