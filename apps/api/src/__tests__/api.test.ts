import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = 'test-secret-that-is-long-enough';

const run = DATABASE_URL ? describe : describe.skip;

interface CategoryRow { id: string; name: string; kind: string }
interface AccountRow { id: string; name: string; balanceMinor: number }
interface TxnRow { id: string; memo: string | null }
const json = <T>(res: Response) => res.json() as Promise<T>;

run('API integration', () => {
  let app: ReturnType<typeof createApp>;
  let accessToken: string;
  let apiKey: string;
  let accountId: string;
  let secondAccountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;
  const email = `test-${Date.now()}@example.com`;

  const call = (path: string, init: RequestInit = {}, token?: string) => {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);
    return app.request(path, { ...init, headers });
  };

  const callKey = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    headers.set('x-api-key', apiKey);
    return app.request(path, { ...init, headers });
  };

  beforeAll(async () => {
    await runMigrations(DATABASE_URL!);
    const { db } = createDb(DATABASE_URL!);
    app = createApp({
      env: {
        DATABASE_URL: DATABASE_URL!,
        API_PORT: 8787,
        JWT_SECRET,
        ACCESS_TOKEN_TTL: '15m',
        REFRESH_TOKEN_TTL_DAYS: 90,
      },
      db,
    });
  });

  it('rejects unauthenticated requests', async () => {
    const res = await call('/api/accounts');
    expect(res.status).toBe(401);
  });

  it('registers a user and seeds default categories', async () => {
    const res = await call('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'password123', name: 'Test' }),
    });
    expect(res.status).toBe(201);
    const body = await json<{ accessToken: string; refreshToken: string }>(res);
    accessToken = body.accessToken;
    expect(body.refreshToken).toMatch(/^mmr_/);

    const cats = await call('/api/categories', {}, accessToken);
    const { categories } = await json<{ categories: CategoryRow[] }>(cats);
    expect(categories.length).toBeGreaterThan(10);
    expenseCategoryId = categories.find((c) => c.name === 'Food')!.id;
    incomeCategoryId = categories.find((c) => c.name === 'Salary')!.id;
  });

  it('logs in', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'password123' }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ accessToken: string }>(res);
    expect(body.accessToken).toBeTruthy();
  });

  it('creates accounts and computes balance', async () => {
    const res = await call('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cash', type: 'cash', initialBalanceMinor: 100000 }),
    }, accessToken);
    expect(res.status).toBe(201);
    accountId = (await json<{ account: AccountRow }>(res)).account.id;

    const res2 = await call('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bank', type: 'bank', initialBalanceMinor: 0 }),
    }, accessToken);
    secondAccountId = (await json<{ account: AccountRow }>(res2)).account.id;

    const list = await call('/api/accounts', {}, accessToken);
    const { accounts } = await json<{ accounts: AccountRow[] }>(list);
    expect(accounts.find((a) => a.name === 'Cash')!.balanceMinor).toBe(100000);
  });

  it('records an expense and an income', async () => {
    const exp = await call('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'expense',
        amountMinor: 25000,
        accountId,
        categoryId: expenseCategoryId,
        date: '2026-09-20',
        memo: 'lunch',
      }),
    }, accessToken);
    expect(exp.status).toBe(201);

    const inc = await call('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'income',
        amountMinor: 500000,
        accountId,
        categoryId: incomeCategoryId,
        date: '2026-09-01',
      }),
    }, accessToken);
    expect(inc.status).toBe(201);
  });

  it('transfers between accounts and updates balances', async () => {
    const res = await call('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'transfer',
        amountMinor: 50000,
        accountId,
        toAccountId: secondAccountId,
        date: '2026-09-21',
      }),
    }, accessToken);
    expect(res.status).toBe(201);

    const list = await call('/api/accounts', {}, accessToken);
    const { accounts } = await json<{ accounts: AccountRow[] }>(list);
    // cash: 100000 + 500000 - 25000 - 50000 = 525000
    expect(accounts.find((a) => a.id === accountId)!.balanceMinor).toBe(525000);
    expect(accounts.find((a) => a.id === secondAccountId)!.balanceMinor).toBe(50000);
  });

  it('lists transactions with filters', async () => {
    const res = await call('/api/transactions?type=expense&q=lunch', {}, accessToken);
    const body = await json<{ transactions: TxnRow[] }>(res);
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]!.memo).toBe('lunch');
  });

  it('returns a period summary grouped by category', async () => {
    const res = await call('/api/stats/summary?from=2026-09-01&to=2026-10-01', {}, accessToken);
    const body = await json<{ incomeMinor: number; expenseMinor: number; byCategory: unknown[] }>(res);
    expect(body.incomeMinor).toBe(500000);
    expect(body.expenseMinor).toBe(25000);
    expect(body.byCategory.length).toBeGreaterThan(0);
  });

  it('tracks budget status', async () => {
    const put = await call('/api/budgets', {
      method: 'PUT',
      body: JSON.stringify({ categoryId: expenseCategoryId, month: '2026-09', amountMinor: 30000 }),
    }, accessToken);
    expect(put.status).toBe(200);

    const res = await call('/api/budgets/status?month=2026-09', {}, accessToken);
    const body = await json<{ status: { categoryName: string; budgetMinor: number; spentMinor: number }[] }>(res);
    const food = body.status.find((s) => s.categoryName === 'Food')!;
    expect(food.budgetMinor).toBe(30000);
    expect(food.spentMinor).toBe(25000);
  });

  it('issues an API key and authenticates with it', async () => {
    const res = await call('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'mcp', scopes: ['read', 'write'] }),
    }, accessToken);
    expect(res.status).toBe(201);
    apiKey = (await json<{ apiKey: { key: string } }>(res)).apiKey.key;
    expect(apiKey).toMatch(/^mm_live_/);

    const list = await callKey('/api/accounts');
    expect(list.status).toBe(200);
  });

  it('enforces read scope on API keys', async () => {
    const res = await call('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'ro', scopes: ['read'] }),
    }, accessToken);
    const readOnlyKey = (await json<{ apiKey: { key: string } }>(res)).apiKey.key;

    const denied = await app.request('/api/transactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': readOnlyKey },
      body: JSON.stringify({
        type: 'expense',
        amountMinor: 1,
        accountId,
        categoryId: expenseCategoryId,
        date: '2026-09-22',
      }),
    });
    expect(denied.status).toBe(403);
  });

  it('rejects an expense without a category', async () => {
    const res = await call('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ type: 'expense', amountMinor: 100, accountId, date: '2026-09-22' }),
    }, accessToken);
    expect(res.status).toBe(400);
  });

  it('rotates refresh tokens', async () => {
    const login = await call('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { refreshToken } = await json<{ refreshToken: string }>(login);

    const refreshed = await call('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    expect(refreshed.status).toBe(200);

    const reused = await call('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    expect(reused.status).toBe(401);
  });
});
