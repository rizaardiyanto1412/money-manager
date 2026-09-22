import { z } from 'zod';

export const accountTypeSchema = z.enum([
  'cash',
  'bank',
  'credit_card',
  'debit_card',
  'savings',
  'investment',
  'other',
]);

export const transactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM');

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(120).optional(),
  currency: z.string().length(3).toUpperCase().default('IDR'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(120),
  type: accountTypeSchema,
  currency: z.string().length(3).toUpperCase().optional(),
  initialBalanceMinor: z.number().int().default(0),
  settlementDay: z.number().int().min(1).max(31).nullish(),
  icon: z.string().max(64).nullish(),
  sortOrder: z.number().int().default(0),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(['income', 'expense']),
  parentId: z.string().uuid().nullish(),
  icon: z.string().max(64).nullish(),
  color: z.string().max(32).nullish(),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  enabled: z.boolean().optional(),
});

export const createTransactionSchema = z
  .object({
    type: transactionTypeSchema,
    amountMinor: z.number().int().positive('Amount must be positive'),
    accountId: z.string().uuid(),
    toAccountId: z.string().uuid().nullish(),
    categoryId: z.string().uuid().nullish(),
    date: isoDateSchema,
    memo: z.string().max(500).nullish(),
  })
  .superRefine((t, ctx) => {
    if (t.type === 'transfer') {
      if (!t.toAccountId) {
        ctx.addIssue({ code: 'custom', message: 'toAccountId is required for transfers', path: ['toAccountId'] });
      }
      if (t.toAccountId === t.accountId) {
        ctx.addIssue({ code: 'custom', message: 'Cannot transfer to the same account', path: ['toAccountId'] });
      }
    } else if (!t.categoryId) {
      ctx.addIssue({ code: 'custom', message: 'categoryId is required for income/expense', path: ['categoryId'] });
    }
  });

export const updateTransactionSchema = z.object({
  type: transactionTypeSchema.optional(),
  amountMinor: z.number().int().positive().optional(),
  accountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  date: isoDateSchema.optional(),
  memo: z.string().max(500).nullish(),
});

export const listTransactionsQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  type: transactionTypeSchema.optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const upsertBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  month: monthSchema,
  amountMinor: z.number().int().nonnegative(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(['read', 'write'])).min(1).default(['read', 'write']),
});

export const createRecurringSchema = z.object({
  type: transactionTypeSchema,
  amountMinor: z.number().int().positive(),
  accountId: z.string().uuid(),
  toAccountId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  memo: z.string().max(500).nullish(),
  rrule: z.string().min(3).max(200),
  nextRunDate: isoDateSchema,
});

export const createBookmarkSchema = z.object({
  name: z.string().min(1).max(120),
  type: transactionTypeSchema,
  amountMinor: z.number().int().positive(),
  accountId: z.string().uuid(),
  toAccountId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  memo: z.string().max(500).nullish(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
