import { describe, expect, it, vi } from 'vitest';
import { buildServer } from './server.js';
import type { MoneyManagerClient } from './api-client.js';

function createClient() {
  return {
    listAccounts: vi.fn().mockResolvedValue({
      accounts: [
        { id: 'a1', name: 'Cash' },
        { id: 'a2', name: 'Bank' },
      ],
    }),
    listCategories: vi.fn().mockResolvedValue({
      categories: [
        { id: 'c1', name: 'Food', kind: 'expense' },
        { id: 'c2', name: 'Salary', kind: 'income' },
      ],
    }),
    addTransaction: vi.fn().mockResolvedValue({ transaction: { id: 't1' } }),
    listTransactions: vi.fn().mockResolvedValue({ transactions: [] }),
    getSummary: vi.fn().mockResolvedValue({ incomeMinor: 10, expenseMinor: 5 }),
    getBudgetStatus: vi.fn().mockResolvedValue({ status: [] }),
  };
}

type RegisteredTool = {
  executor: (args: unknown, context: unknown) => Promise<Record<string, unknown>>;
};

function registeredTools(server: ReturnType<typeof buildServer>): Record<string, RegisteredTool> {
  return (server as unknown as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
}

async function execute(
  tools: Record<string, RegisteredTool>,
  name: string,
  args: Record<string, unknown>,
) {
  return tools[name]!.executor(args, {});
}

describe('buildServer', () => {
  it('registers the eight tools', () => {
    const tools = registeredTools(buildServer({ client: createClient() as never as MoneyManagerClient }));
    expect(Object.keys(tools).sort()).toEqual([
      'add_expense',
      'add_income',
      'add_transfer',
      'get_budget_status',
      'get_summary',
      'list_accounts',
      'list_categories',
      'list_transactions',
    ]);
  });

  it('add_expense resolves names and posts an expense transaction', async () => {
    const client = createClient();
    const tools = registeredTools(buildServer({ client: client as never as MoneyManagerClient }));

    await execute(tools, 'add_expense', {
      amountMinor: 25000,
      account: 'cash',
      category: 'Food',
      date: '2026-09-22',
      memo: 'lunch',
    });

    expect(client.addTransaction).toHaveBeenCalledWith({
      type: 'expense',
      amountMinor: 25000,
      accountId: 'a1',
      categoryId: 'c1',
      date: '2026-09-22',
      memo: 'lunch',
    });
  });

  it('add_expense returns an error for an unknown category', async () => {
    const client = createClient();
    const tools = registeredTools(buildServer({ client: client as never as MoneyManagerClient }));

    const res = await execute(tools, 'add_expense', {
      amountMinor: 25000,
      account: 'Cash',
      category: 'Nope',
      date: '2026-09-22',
    });

    expect(res.isError).toBe(true);
    expect(client.addTransaction).not.toHaveBeenCalled();
  });

  it('add_transfer posts a transfer between named accounts', async () => {
    const client = createClient();
    const tools = registeredTools(buildServer({ client: client as never as MoneyManagerClient }));

    await execute(tools, 'add_transfer', {
      amountMinor: 50000,
      account: 'Cash',
      toAccount: 'Bank',
      date: '2026-09-22',
    });

    expect(client.addTransaction).toHaveBeenCalledWith({
      type: 'transfer',
      amountMinor: 50000,
      accountId: 'a1',
      toAccountId: 'a2',
      date: '2026-09-22',
    });
  });

  it('list_transactions forwards filters to the client', async () => {
    const client = createClient();
    const tools = registeredTools(buildServer({ client: client as never as MoneyManagerClient }));

    await execute(tools, 'list_transactions', { type: 'expense', q: 'lunch', limit: 10, offset: 0 });

    expect(client.listTransactions).toHaveBeenCalledWith({
      type: 'expense',
      q: 'lunch',
      limit: 10,
      offset: 0,
    });
  });

  it('get_budget_status forwards the month', async () => {
    const client = createClient();
    const tools = registeredTools(buildServer({ client: client as never as MoneyManagerClient }));

    await execute(tools, 'get_budget_status', { month: '2026-09' });
    expect(client.getBudgetStatus).toHaveBeenCalledWith('2026-09');
  });
});
