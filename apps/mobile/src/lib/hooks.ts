import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Account,
  BudgetStatus,
  Category,
  CategorySummary,
  PeriodSummary,
  Transaction,
} from '@money-manager/shared';
import { api } from './api';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api<{ accounts: (Account & { balanceMinor: number })[] }>('/api/accounts'),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ categories: Category[] }>('/api/categories'),
  });
}

export interface TxnFilters {
  from?: string;
  to?: string;
  type?: string;
  accountId?: string;
  categoryId?: string;
  q?: string;
  limit?: number;
}

export function useTransactions(filters: TxnFilters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const qs = params.toString();
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api<{ transactions: Transaction[] }>(`/api/transactions${qs ? `?${qs}` : ''}`),
  });
}

export interface NewTransaction {
  type: 'expense' | 'income' | 'transfer';
  amountMinor: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  date: string;
  memo?: string;
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewTransaction) =>
      api<{ transaction: Transaction }>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['budgetStatus'] });
      void qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      void qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}

export function useAddAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: string; initialBalanceMinor?: number }) =>
      api<{ account: Account }>('/api/accounts', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; kind: 'expense' | 'income'; parentId?: string }) =>
      api<{ category: Category }>('/api/categories', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useSummary(from: string, to: string) {
  return useQuery({
    queryKey: ['summary', from, to],
    queryFn: () =>
      api<PeriodSummary & { byCategory: CategorySummary[] }>(
        `/api/stats/summary?from=${from}&to=${to}`,
      ),
  });
}

export function useDaily(from: string, to: string) {
  return useQuery({
    queryKey: ['daily', from, to],
    queryFn: () =>
      api<{ days: { date: string; incomeMinor: number; expenseMinor: number }[] }>(
        `/api/stats/daily?from=${from}&to=${to}`,
      ),
  });
}

export function useBudgetStatus(month: string) {
  return useQuery({
    queryKey: ['budgetStatus', month],
    queryFn: () => api<{ month: string; status: BudgetStatus[] }>(`/api/budgets/status?month=${month}`),
  });
}
