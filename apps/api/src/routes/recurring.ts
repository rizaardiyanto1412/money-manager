import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createRecurringSchema } from '@money-manager/shared';
import { recurringTransactions } from '../db/schema.js';

const updateRecurringSchema = createRecurringSchema.partial().extend({
  active: z.boolean().optional(),
});

export const recurringRoutes = new Hono()
  .get('/', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const rows = await db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.userId, userId))
      .orderBy(asc(recurringTransactions.nextRunDate));
    return c.json({ recurring: rows });
  })
  .post('/', zValidator('json', createRecurringSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const input = c.req.valid('json');
    const [row] = await db.insert(recurringTransactions).values({ ...input, userId }).returning();
    return c.json({ recurring: row }, 201);
  })
  .patch('/:id', zValidator('json', updateRecurringSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .update(recurringTransactions)
      .set(c.req.valid('json'))
      .where(and(eq(recurringTransactions.id, c.req.param('id')), eq(recurringTransactions.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Recurring transaction not found' }, 404);
    return c.json({ recurring: row });
  })
  .delete('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .delete(recurringTransactions)
      .where(and(eq(recurringTransactions.id, c.req.param('id')), eq(recurringTransactions.userId, userId)))
      .returning({ id: recurringTransactions.id });
    if (!row) return c.json({ error: 'Recurring transaction not found' }, 404);
    return c.json({ ok: true });
  });
