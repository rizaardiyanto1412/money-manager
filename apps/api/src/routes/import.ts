import { Hono } from 'hono';
import { and, eq, ilike, isNull } from 'drizzle-orm';
import { accounts, categories, transactions } from '../db/schema.js';
import type { Database } from '../db/client.js';
import { parseRealbyteFile, type ParsedRow } from '../lib/realbyte.js';

/** db or an in-flight transaction — same query surface. */
type DbOrTx = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

const lower = (s: string) => s.trim().toLowerCase();

async function ensureAccount(db: DbOrTx, userId: string, name: string) {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), ilike(accounts.name, name)))
    .limit(1);
  if (existing) return { account: existing, created: false };
  const [created] = await db
    .insert(accounts)
    .values({ userId, name, type: 'other' })
    .returning();
  return { account: created!, created: true };
}

async function ensureCategory(
  db: DbOrTx,
  userId: string,
  name: string,
  kind: 'expense' | 'income',
  parentId: string | null = null,
) {
  const [existing] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        ilike(categories.name, name),
        eq(categories.kind, kind),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
      ),
    )
    .limit(1);
  if (existing) return { category: existing, created: false };
  const [created] = await db
    .insert(categories)
    .values({ userId, name, kind, parentId })
    .returning();
  return { category: created!, created: true };
}

async function txnExists(
  db: DbOrTx,
  userId: string,
  t: { date: string; type: string; amountMinor: number; accountId: string; memo?: string },
) {
  const conds = [
    eq(transactions.userId, userId),
    eq(transactions.date, t.date),
    eq(transactions.type, t.type as 'expense' | 'income' | 'transfer'),
    eq(transactions.amountMinor, t.amountMinor),
    eq(transactions.accountId, t.accountId),
  ];
  const [hit] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(...conds))
    .limit(1);
  return !!hit;
}

export const importRoutes = new Hono().post('/realbyte', async (c) => {
  const db = c.get('db');
  const { userId } = c.get('auth');
  const dryRun = c.req.query('dryRun') === '1' || c.req.query('dryRun') === 'true';

  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'Missing multipart field "file"' }, 400);
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength > 10 * 1024 * 1024) return c.json({ error: 'File too large (10MB max)' }, 413);

  let parsed;
  try {
    parsed = parseRealbyteFile(buf);
  } catch {
    return c.json({ error: 'Could not parse file — expected .xlsx/.xls/.csv from Money Manager' }, 400);
  }

  const apply = !dryRun;
  const stats = {
    parsed: parsed.rows.length,
    errors: parsed.errors.length,
    inserted: 0,
    skippedDuplicates: 0,
    accountsCreated: [] as string[],
    categoriesCreated: [] as string[],
  };

  if (!apply) {
    return c.json({
      dryRun: true,
      stats,
      errors: parsed.errors.slice(0, 50),
      preview: parsed.rows.slice(0, 25),
      headers: parsed.headers,
    });
  }

  await db.transaction(async (tx) => {
    const accountByName = new Map<string, string>();
    const categoryByKey = new Map<string, string>();

    const accountId = async (name: string) => {
      const key = lower(name);
      const hit = accountByName.get(key);
      if (hit) return hit;
      const { account, created } = await ensureAccount(tx, userId, name);
      accountByName.set(key, account.id);
      if (created) stats.accountsCreated.push(account.name);
      return account.id;
    };

    const categoryId = async (row: ParsedRow) => {
      if (row.type === 'transfer') return null;
      const kind = row.type;
      const parentKey = `${kind}:${lower(row.category!)}:`;
      if (!categoryByKey.has(parentKey)) {
        const { category, created } = await ensureCategory(tx, userId, row.category!, kind);
        categoryByKey.set(parentKey, category.id);
        if (created) stats.categoriesCreated.push(category.name);
      }
      const parentId = categoryByKey.get(parentKey)!;
      if (!row.subcategory) return parentId;
      const subKey = `${kind}:${lower(row.category!)}:${lower(row.subcategory)}`;
      if (!categoryByKey.has(subKey)) {
        const { category, created } = await ensureCategory(
          tx,
          userId,
          row.subcategory,
          kind,
          parentId,
        );
        categoryByKey.set(subKey, category.id);
        if (created) stats.categoriesCreated.push(`${row.category} / ${category.name}`);
      }
      return categoryByKey.get(subKey)!;
    };

    for (const row of parsed.rows) {
      const fromId = await accountId(row.account);
      const toId = row.type === 'transfer' ? await accountId(row.category!) : null;
      const catId = await categoryId(row);
      if (
        await txnExists(tx, userId, {
          date: row.date,
          type: row.type,
          amountMinor: row.amountMinor,
          accountId: fromId,
        })
      ) {
        stats.skippedDuplicates++;
        continue;
      }
      await tx.insert(transactions).values({
        userId,
        type: row.type,
        amountMinor: row.amountMinor,
        accountId: fromId,
        toAccountId: toId,
        categoryId: catId,
        date: row.date,
        memo: row.memo,
      });
      stats.inserted++;
    }
  });

  return c.json({ dryRun: false, stats, errors: parsed.errors.slice(0, 50) });
});
