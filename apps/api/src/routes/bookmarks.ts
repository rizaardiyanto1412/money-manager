import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq } from 'drizzle-orm';
import { createBookmarkSchema } from '@money-manager/shared';
import { bookmarks } from '../db/schema.js';

export const bookmarksRoutes = new Hono()
  .get('/', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const rows = await db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(asc(bookmarks.sortOrder), asc(bookmarks.createdAt));
    return c.json({ bookmarks: rows });
  })
  .post('/', zValidator('json', createBookmarkSchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const input = c.req.valid('json');
    const [row] = await db.insert(bookmarks).values({ ...input, userId }).returning();
    return c.json({ bookmark: row }, 201);
  })
  .patch('/:id', zValidator('json', createBookmarkSchema.partial()), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .update(bookmarks)
      .set(c.req.valid('json'))
      .where(and(eq(bookmarks.id, c.req.param('id')), eq(bookmarks.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Bookmark not found' }, 404);
    return c.json({ bookmark: row });
  })
  .delete('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.id, c.req.param('id')), eq(bookmarks.userId, userId)))
      .returning({ id: bookmarks.id });
    if (!row) return c.json({ error: 'Bookmark not found' }, 404);
    return c.json({ ok: true });
  });
