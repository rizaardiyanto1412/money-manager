import { createMiddleware } from 'hono/factory';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { apiKeys } from '../db/schema.js';
import { sha256, verifyAccessToken } from '../lib/tokens.js';
import type { Env } from '../env.js';

export interface AuthContext {
  userId: string;
  authType: 'jwt' | 'apikey';
  scopes: string[];
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
    db: Database;
    env: Env;
  }
}

export function requiredScope(method: string): 'read' | 'write' {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'read' : 'write';
}

/** Accepts `Authorization: Bearer <jwt>` or `x-api-key: mm_live_...`. */
export function authMiddleware() {
  return createMiddleware(async (c, next) => {
    const db = c.get('db');
    const env = c.get('env');
    const scope = requiredScope(c.req.method);

    const bearer = c.req.header('authorization');
    if (bearer?.startsWith('Bearer ')) {
      const claims = await verifyAccessToken(bearer.slice(7), env.JWT_SECRET);
      if (!claims) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }
      c.set('auth', { userId: claims.userId, authType: 'jwt', scopes: ['read', 'write'] });
      return next();
    }

    const apiKey = c.req.header('x-api-key');
    if (apiKey) {
      const hash = sha256(apiKey);
      const [row] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
        .limit(1);
      if (!row) {
        return c.json({ error: 'Invalid API key' }, 401);
      }
      if (!row.scopes.includes(scope)) {
        return c.json({ error: `API key lacks '${scope}' scope` }, 403);
      }
      void db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, row.id));
      c.set('auth', { userId: row.userId, authType: 'apikey', scopes: row.scopes });
      return next();
    }

    return c.json({ error: 'Missing authorization' }, 401);
  });
}
