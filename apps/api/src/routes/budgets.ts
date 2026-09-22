import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { monthSchema, upsertBudgetSchema } from '@money-manager/shared';
import { budgets, categories, transactions } from '../db/schema.js';

export const budgetsRoutes = new Hono()
  .get('/', zValidator('query', z.object({ month: monthSchema.optional() })), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const { month } = c.req.valid('query');
    const rows = await db
      .select()
      .from(budgets)
      .where(month ? and(eq(budgets.userId, userId), eq(budgets.month, month)) : eq(budgets.userId, userId));
    return c.json({ budgets: rows });
  })
  .put('/', zValidator('json', upsertBudgetSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const input = c.req.valid('json');

    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!cat) return c.json({ error: 'Category not found' }, 400);

    const [row] = await db
      .insert(budgets)
      .values({ ...input, userId })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: { amountMinor: input.amountMinor },
      })
      .returning();
    return c.json({ budget: row });
  })
  .delete('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .delete(budgets)
      .where(and(eq(budgets.id, c.req.param('id')), eq(budgets.userId, userId)))
      .returning({ id: budgets.id });
    if (!row) return c.json({ error: 'Budget not found' }, 404);
    return c.json({ ok: true });
  })
  .get('/status', zValidator('query', z.object({ month: monthSchema })), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const { month } = c.req.valid('query');
    const from = `${month}-01`;
    // exclusive upper bound = first day of next month (handles year rollover)
    const [y, m] = month.split('-').map(Number);
    const to = new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 10);

    const rows = await db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        budgetMinor: budgets.amountMinor,
        // correlated refs as literal qualified names — see balanceSql note
        spentMinor: sql<number>`coalesce((
          select sum(t.amount_minor) from ${transactions} t
          where t.user_id = ${userId}
            and t.type = 'expense'
            and t.date >= ${from}
            and t.date < ${to}
            and (t.category_id = budgets.category_id
              or t.category_id in (select c2.id from ${categories} c2 where c2.parent_id = budgets.category_id))
        ), 0)`.mapWith(Number),
      })
      .from(budgets)
      .innerJoin(categories, eq(categories.id, budgets.categoryId))
      .where(and(eq(budgets.userId, userId), eq(budgets.month, month)));

    const status = rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      budgetMinor: r.budgetMinor,
      spentMinor: r.spentMinor,
      remainingMinor: r.budgetMinor - r.spentMinor,
      percentUsed: r.budgetMinor > 0 ? Math.round((r.spentMinor / r.budgetMinor) * 1000) / 10 : 0,
    }));
    return c.json({ month, status });
  });
