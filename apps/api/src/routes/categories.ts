import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq } from 'drizzle-orm';
import { createCategorySchema, updateCategorySchema } from '@money-manager/shared';
import { categories } from '../db/schema.js';

export const categoriesRoutes = new Hono()
  .get('/', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.sortOrder), asc(categories.createdAt));
    return c.json({ categories: rows });
  })
  .post('/', zValidator('json', createCategorySchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const input = c.req.valid('json');
    if (input.parentId) {
      const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.parentId), eq(categories.userId, userId)))
        .limit(1);
      if (!parent) return c.json({ error: 'Parent category not found' }, 400);
    }
    const [row] = await db.insert(categories).values({ ...input, userId }).returning();
    return c.json({ category: row }, 201);
  })
  .patch('/:id', zValidator('json', updateCategorySchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const input = c.req.valid('json');
    if (input.parentId === id) {
      return c.json({ error: 'A category cannot be its own parent' }, 400);
    }
    const [row] = await db
      .update(categories)
      .set(input)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Category not found' }, 404);
    return c.json({ category: row });
  })
  .delete('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const [row] = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning({ id: categories.id });
    if (!row) return c.json({ error: 'Category not found' }, 404);
    return c.json({ ok: true });
  });
