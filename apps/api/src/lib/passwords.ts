import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hashHex] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
