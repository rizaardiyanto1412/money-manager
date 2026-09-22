import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { loginSchema, refreshSchema, registerSchema } from '@money-manager/shared';
import { refreshTokens, users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { generateRefreshToken, signAccessToken, sha256 } from '../lib/tokens.js';
import { seedDefaultCategories } from '../db/seed.js';
import type { Env } from '../env.js';

function refreshExpiry(env: Env): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueTokens(db: Parameters<typeof seedDefaultCategories>[0], env: Env, userId: string) {
  const accessToken = await signAccessToken(userId, env.JWT_SECRET, env.ACCESS_TOKEN_TTL);
  const { token: refreshToken, hash } = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hash,
    expiresAt: refreshExpiry(env),
  });
  return { accessToken, refreshToken, tokenType: 'Bearer' as const };
}

export const authRoutes = new Hono()
  .post('/register', zValidator('json', registerSchema), async (c) => {
    const db = c.get('db');
    const env = c.get('env');
    const { email, password, name, currency } = c.req.valid('json');

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(password), name: name ?? '', currency })
      .returning();
    if (!user) return c.json({ error: 'Registration failed' }, 500);

    await seedDefaultCategories(db, user.id);
    const tokens = await issueTokens(db, env, user.id);
    return c.json({ user: { id: user.id, email: user.email, name: user.name, currency: user.currency }, ...tokens }, 201);
  })
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const db = c.get('db');
    const env = c.get('env');
    const { email, password } = c.req.valid('json');

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const tokens = await issueTokens(db, env, user.id);
    return c.json({ user: { id: user.id, email: user.email, name: user.name, currency: user.currency }, ...tokens });
  })
  .post('/refresh', zValidator('json', refreshSchema), async (c) => {
    const db = c.get('db');
    const env = c.get('env');
    const { refreshToken } = c.req.valid('json');

    const hash = sha256(refreshToken);
    const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash)).limit(1);
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    // Rotate: revoke old, issue new pair.
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
    const tokens = await issueTokens(db, env, row.userId);
    return c.json(tokens);
  })
  .post('/logout', zValidator('json', refreshSchema), async (c) => {
    const db = c.get('db');
    const { refreshToken } = c.req.valid('json');
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
    return c.json({ ok: true });
  });
