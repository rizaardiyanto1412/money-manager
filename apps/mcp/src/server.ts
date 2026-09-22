import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { isoDateSchema, monthSchema, transactionTypeSchema } from '@money-manager/shared';
import type { MoneyManagerClient } from './api-client.js';

export interface BuildServerOptions {
  client: MoneyManagerClient;
  version?: string;
}

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const errorText = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true as const,
});

interface Named {
  id: string;
  name: string;
  kind?: string;
}

/** Match a name-or-UUID against API rows: exact UUID, exact name, then unique substring. */
function resolveNamed(rows: Named[], ref: string, label: string): Named {
  const byId = rows.find((r) => r.id === ref);
  if (byId) return byId;
  const lower = ref.toLowerCase();
  const exact = rows.filter((r) => r.name.toLowerCase() === lower);
  if (exact.length === 1) return exact[0]!;
  const partial = rows.filter((r) => r.name.toLowerCase().includes(lower));
  const candidates = exact.length > 0 ? exact : partial;
  if (candidates.length === 1) return candidates[0]!;
  const names = candidates.map((r) => r.name).join(', ') || 'none';
  throw new Error(
    candidates.length > 1
      ? `Ambiguous ${label} "${ref}" — matches: ${names}. Pass the UUID instead.`
      : `Unknown ${label} "${ref}". Available: ${rows.map((r) => r.name).join(', ') || 'none'}`,
  );
}

const nameOrId = (label: string) =>
  z.string().min(1).describe(`${label} name or UUID — call the matching list_* tool to see options`);

const txnFields = {
  amountMinor: z
    .number()
    .int()
    .positive()
    .describe('Amount in minor units — for IDR this is the rupiah amount, no decimals'),
  account: nameOrId('Account'),
  category: nameOrId('Category'),
  date: isoDateSchema.describe('Transaction date, YYYY-MM-DD'),
  memo: z.string().max(500).optional().describe('Optional note'),
};

export function buildServer({ client, version = '0.1.0' }: BuildServerOptions): McpServer {
  const server = new McpServer({ name: 'money-manager', version });

  const resolveAccount = async (ref: string): Promise<Named> => {
    const { accounts } = (await client.listAccounts()) as { accounts: Named[] };
    return resolveNamed(accounts, ref, 'account');
  };

  const resolveCategory = async (ref: string, kind: 'income' | 'expense'): Promise<Named> => {
    const { categories } = (await client.listCategories()) as { categories: Named[] };
    const ofKind = categories.filter((c) => c.kind === kind);
    return resolveNamed(ofKind.length > 0 ? ofKind : categories, ref, `${kind} category`);
  };

  server.registerTool(
    'list_accounts',
    {
      title: 'List Accounts',
      description: 'List money accounts (cash, bank, cards) with current balances',
      inputSchema: z.object({}),
    },
    async () => text(await client.listAccounts()),
  );

  server.registerTool(
    'list_categories',
    {
      title: 'List Categories',
      description: 'List income/expense categories and subcategories',
      inputSchema: z.object({}),
    },
    async () => text(await client.listCategories()),
  );

  const addTyped =
    (type: 'expense' | 'income') =>
    async (input: { amountMinor: number; account: string; category: string; date: string; memo?: string }) => {
      try {
        const [account, category] = await Promise.all([
          resolveAccount(input.account),
          resolveCategory(input.category, type),
        ]);
        const { transaction } = await client.addTransaction({
          type,
          amountMinor: input.amountMinor,
          accountId: account.id,
          categoryId: category.id,
          date: input.date,
          memo: input.memo,
        });
        return text({ recorded: true, transaction });
      } catch (e) {
        return errorText(e instanceof Error ? e.message : String(e));
      }
    };

  server.registerTool(
    'add_expense',
    {
      title: 'Add Expense',
      description: 'Record an expense against an account and category (names or UUIDs)',
      inputSchema: z.object(txnFields),
    },
    addTyped('expense'),
  );

  server.registerTool(
    'add_income',
    {
      title: 'Add Income',
      description: 'Record income into an account and category (names or UUIDs)',
      inputSchema: z.object(txnFields),
    },
    addTyped('income'),
  );

  server.registerTool(
    'add_transfer',
    {
      title: 'Add Transfer',
      description: 'Transfer money between two accounts (names or UUIDs)',
      inputSchema: z.object({
        amountMinor: txnFields.amountMinor,
        account: txnFields.account.describe('Source account'),
        toAccount: txnFields.account.describe('Destination account'),
        date: txnFields.date,
        memo: txnFields.memo,
      }),
    },
    async (input) => {
      try {
        const [account, toAccount] = await Promise.all([
          resolveAccount(input.account),
          resolveAccount(input.toAccount),
        ]);
        const { transaction } = await client.addTransaction({
          type: 'transfer',
          amountMinor: input.amountMinor,
          accountId: account.id,
          toAccountId: toAccount.id,
          date: input.date,
          memo: input.memo,
        });
        return text({ recorded: true, transaction });
      } catch (e) {
        return errorText(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    'list_transactions',
    {
      title: 'List Transactions',
      description: 'Query transactions with optional filters',
      inputSchema: z.object({
        from: isoDateSchema.optional().describe('Start date (inclusive)'),
        to: isoDateSchema.optional().describe('End date (inclusive)'),
        type: transactionTypeSchema.optional(),
        accountId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        q: z.string().max(200).optional().describe('Search memo text'),
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    },
    async (input) => text(await client.listTransactions(input)),
  );

  server.registerTool(
    'get_summary',
    {
      title: 'Get Summary',
      description: 'Income vs expense totals and per-category breakdown for a date range',
      inputSchema: z.object({
        from: isoDateSchema.describe('Start date (inclusive)'),
        to: isoDateSchema.describe('End date (exclusive)'),
      }),
    },
    async ({ from, to }) => text(await client.getSummary(from, to)),
  );

  server.registerTool(
    'get_budget_status',
    {
      title: 'Get Budget Status',
      description: 'Budget vs actual spending per category for a month',
      inputSchema: z.object({ month: monthSchema.describe('Month, YYYY-MM') }),
    },
    async ({ month }) => text(await client.getBudgetStatus(month)),
  );

  return server;
}
