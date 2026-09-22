import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { isoDateSchema } from '@money-manager/shared';
import { categories, transactions } from '../db/schema.js';

const summaryQuery = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export const statsRoutes = new Hono()
  .get('/summary', zValidator('query', summaryQuery), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const { from, to } = c.req.valid('query');

    const [totals] = await db
      .select({
        incomeMinor: sql<number>`coalesce(sum(case when type = 'income' then amount_minor end), 0)`.mapWith(Number),
        expenseMinor: sql<number>`coalesce(sum(case when type = 'expense' then amount_minor end), 0)`.mapWith(Number),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, from), lt(transactions.date, to)));

    const byCategory = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        kind: categories.kind,
        totalMinor: sql<number>`sum(${transactions.amountMinor})`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(eq(transactions.userId, userId), gte(transactions.date, from), lt(transactions.date, to)))
      .groupBy(transactions.categoryId, categories.name, categories.kind);

    return c.json({
      from,
      to,
      incomeMinor: totals?.incomeMinor ?? 0,
      expenseMinor: totals?.expenseMinor ?? 0,
      netMinor: (totals?.incomeMinor ?? 0) - (totals?.expenseMinor ?? 0),
      byCategory: byCategory.filter((r) => r.categoryId !== null),
    });
  })
  .get('/daily', zValidator('query', summaryQuery), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const { from, to } = c.req.valid('query');

    const rows = await db
      .select({
        date: transactions.date,
        incomeMinor: sql<number>`coalesce(sum(case when type = 'income' then amount_minor end), 0)`.mapWith(Number),
        expenseMinor: sql<number>`coalesce(sum(case when type = 'expense' then amount_minor end), 0)`.mapWith(Number),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, from), lt(transactions.date, to)))
      .groupBy(transactions.date)
      .orderBy(transactions.date);

    return c.json({ from, to, days: rows });
  });
