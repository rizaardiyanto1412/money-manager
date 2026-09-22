/** Shared domain types for Money Manager. Money is always integer minor units (cents). */

export type AccountType =
  | 'cash'
  | 'bank'
  | 'credit_card'
  | 'debit_card'
  | 'savings'
  | 'investment'
  | 'other';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type CategoryKind = 'income' | 'expense';

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
  createdAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  /** Computed: initial balance + applied transactions. */
  balanceMinor: number;
  /** For credit cards: day of month the statement settles (1-31). */
  settlementDay: number | null;
  icon: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amountMinor: number;
  accountId: string;
  /** Destination account for transfers. */
  toAccountId: string | null;
  categoryId: string | null;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  memo: string | null;
  receiptPath: string | null;
  recurringId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  /** Month in YYYY-MM form. */
  month: string;
  amountMinor: number;
  createdAt: string;
}

export interface BudgetStatus {
  categoryId: string;
  categoryName: string;
  budgetMinor: number;
  spentMinor: number;
  remainingMinor: number;
  percentUsed: number;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amountMinor: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  memo: string | null;
  /** RRULE string, e.g. FREQ=MONTHLY;BYMONTHDAY=1 */
  rrule: string;
  nextRunDate: string;
  active: boolean;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
  amountMinor: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  memo: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  /** Only returned once at creation. */
  key?: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  kind: CategoryKind;
  totalMinor: number;
  count: number;
}

export interface PeriodSummary {
  from: string;
  to: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  byCategory: CategorySummary[];
}
