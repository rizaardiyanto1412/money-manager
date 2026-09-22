import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { categories } from './schema.js';
import { fileURLToPath } from 'node:url';
import { createDb } from './client.js';
import { getEnv } from '../env.js';
import { users } from './schema.js';

export interface SeedCategory {
  name: string;
  kind: 'income' | 'expense';
  icon: string;
  children?: string[];
}

/** Default categories mirroring Realbyte Money Manager's starter set. */
export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Food', kind: 'expense', icon: '🍚' },
  { name: 'Transport', kind: 'expense', icon: '🚌' },
  { name: 'Shopping', kind: 'expense', icon: '🛍️', children: ['Clothing', 'Electronics', 'Home'] },
  { name: 'Bills & Utilities', kind: 'expense', icon: '💡', children: ['Electricity', 'Water', 'Internet', 'Phone'] },
  { name: 'Entertainment', kind: 'expense', icon: '🎮' },
  { name: 'Health', kind: 'expense', icon: '💊' },
  { name: 'Education', kind: 'expense', icon: '📚' },
  { name: 'Groceries', kind: 'expense', icon: '🥦' },
  { name: 'Dining Out', kind: 'expense', icon: '🍽️' },
  { name: 'Travel', kind: 'expense', icon: '✈️' },
  { name: 'Subscriptions', kind: 'expense', icon: '🔁' },
  { name: 'Other Expense', kind: 'expense', icon: '📦' },
  { name: 'Salary', kind: 'income', icon: '💼' },
  { name: 'Business', kind: 'income', icon: '🏪' },
  { name: 'Investment', kind: 'income', icon: '📈', children: ['Dividends', 'Interest', 'Capital Gains'] },
  { name: 'Gift', kind: 'income', icon: '🎁' },
  { name: 'Other Income', kind: 'income', icon: '💰' },
];

export async function seedDefaultCategories(db: Database, userId: string) {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId))
    .limit(1);
  if (existing.length > 0) return;

  let sort = 0;
  for (const cat of DEFAULT_CATEGORIES) {
    const [parent] = await db
      .insert(categories)
      .values({ userId, name: cat.name, kind: cat.kind, icon: cat.icon, sortOrder: sort++ })
      .returning({ id: categories.id });
    if (!parent) continue;
    for (const childName of cat.children ?? []) {
      await db.insert(categories).values({
        userId,
        name: childName,
        kind: cat.kind,
        parentId: parent.id,
        sortOrder: sort++,
      });
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = getEnv();
  const { db, close } = createDb(env.DATABASE_URL);
  try {
    const allUsers = await db.select({ id: users.id }).from(users);
    for (const u of allUsers) {
      await seedDefaultCategories(db, u.id);
    }
    console.log(`Seeded categories for ${allUsers.length} user(s).`);
  } finally {
    await close();
  }
}
