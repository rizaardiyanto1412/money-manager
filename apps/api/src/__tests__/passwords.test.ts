import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { generateApiKey, generateRefreshToken, sha256 } from '../lib/tokens.js';

describe('passwords', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('hunter2hunter2');
    expect(hash).toMatch(/^scrypt:/);
    expect(await verifyPassword('hunter2hunter2', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('tokens', () => {
  it('generates prefixed API keys with sha256 hashes', () => {
    const { key, hash } = generateApiKey();
    expect(key).toMatch(/^mm_live_[0-9a-f]{48}$/);
    expect(hash).toBe(sha256(key));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates refresh tokens', () => {
    const { token, hash } = generateRefreshToken();
    expect(token).toMatch(/^mmr_[0-9a-f]{64}$/);
    expect(hash).toBe(sha256(token));
  });
});
