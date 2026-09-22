import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const accountTypeEnum = pgEnum('account_type', [
  'cash',
  'bank',
  'credit_card',
  'debit_card',
  'savings',
  'investment',
  'other',
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',
  'expense',
  'transfer',
]);

export const categoryKindEnum = pgEnum('category_kind', ['income', 'expense']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull().default(''),
  currency: text('currency').notNull().default('IDR'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    scopes: text('scopes').array().notNull().default(['read', 'write']),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('api_keys_user_idx').on(t.userId)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull(),
    currency: text('currency').notNull().default('IDR'),
    initialBalanceMinor: bigint('initial_balance_minor', { mode: 'number' })
      .notNull()
      .default(0),
    settlementDay: integer('settlement_day'),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: categoryKindEnum('kind').notNull(),
    parentId: uuid('parent_id'),
    icon: text('icon'),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('categories_user_idx').on(t.userId)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: transactionTypeEnum('type').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    toAccountId: uuid('to_account_id'),
    categoryId: uuid('category_id'),
    date: date('date').notNull(),
    memo: text('memo'),
    receiptPath: text('receipt_path'),
    recurringId: uuid('recurring_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.date),
    index('transactions_category_idx').on(t.categoryId),
    index('transactions_account_idx').on(t.accountId),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('budgets_user_cat_month_idx').on(t.userId, t.categoryId, t.month)],
);

export const recurringTransactions = pgTable(
  'recurring_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: transactionTypeEnum('type').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    toAccountId: uuid('to_account_id'),
    categoryId: uuid('category_id'),
    memo: text('memo'),
    rrule: text('rrule').notNull(),
    nextRunDate: date('next_run_date').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('recurring_user_idx').on(t.userId)],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: transactionTypeEnum('type').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    toAccountId: uuid('to_account_id'),
    categoryId: uuid('category_id'),
    memo: text('memo'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('bookmarks_user_idx').on(t.userId)],
);
