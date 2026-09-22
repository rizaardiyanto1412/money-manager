import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateApiKey(): { key: string; hash: string } {
  const key = `mm_live_${randomBytes(24).toString('hex')}`;
  return { key, hash: sha256(key) };
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = `mmr_${randomBytes(32).toString('hex')}`;
  return { token, hash: sha256(token) };
}

export async function signAccessToken(
  userId: string,
  secret: string,
  ttl: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key);
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<{ userId: string } | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return typeof payload.sub === 'string' ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}
