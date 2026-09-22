import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createApiKeySchema } from '@money-manager/shared';
import { apiKeys } from '../db/schema.js';
import { generateApiKey } from '../lib/tokens.js';

export const apiKeysRoutes = new Hono()
  .get('/', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));
    return c.json({ apiKeys: rows });
  })
  .post('/', zValidator('json', createApiKeySchema), async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const input = c.req.valid('json');
    const { key, hash } = generateApiKey();
    const [row] = await db
      .insert(apiKeys)
      .values({ userId, name: input.name, keyHash: hash, scopes: input.scopes })
      .returning();
    // Plaintext key is shown exactly once.
    return c.json({ apiKey: { ...row, key } }, 201);
  })
  .delete('/:id', async (c) => {
    const db = c.get('db');
    const { userId } = c.get('auth');
    const [row] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, c.req.param('id')), eq(apiKeys.userId, userId)))
      .returning({ id: apiKeys.id });
    if (!row) return c.json({ error: 'API key not found' }, 404);
    return c.json({ ok: true });
  });
