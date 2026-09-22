import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip, Searchbar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import type { Transaction } from '@money-manager/shared';
import {
  useAccounts,
  useCategories,
  useSummary,
  useTransactions,
  type TxnFilters,
} from '@/lib/hooks';
import { formatMinor, formatSigned } from '@/lib/format';
import { cardStyle, type AppColors } from '@/theme';

const TYPE_FILTERS = ['all', 'expense', 'income', 'transfer'] as const;

const TYPE_ICON: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; bg: string }> = {
  expense: { icon: 'arrow-up-right', bg: '#FDECEA' },
  income: { icon: 'arrow-down-left', bg: '#E8F5E9' },
  transfer: { icon: 'swap-horizontal', bg: '#E3F2FD' },
};

function groupByDate(rows: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const t of rows) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
}

function StatCard(props: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={[styles.statCard, cardStyle]}>
      <View style={styles.statIconWrap}>
        <MaterialCommunityIcons name={props.icon} size={20} color={props.iconColor} />
      </View>
      <View>
        <Text variant="labelMedium" style={{ opacity: 0.55 }}>
          {props.label}
        </Text>
        <Text variant="titleLarge" style={{ fontWeight: '700' }}>
          {props.value}
        </Text>
        {props.sub ? (
          <Text variant="labelSmall" style={{ opacity: 0.5 }}>
            {props.sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>('all');
  const [q, setQ] = useState('');

  const filters: TxnFilters = {
    type: type === 'all' ? undefined : type,
    q: q || undefined,
    limit: 200,
  };
  const txns = useTransactions(filters);
  const accounts = useAccounts();
  const categories = useCategories();
  const month = format(new Date(), 'yyyy-MM');
  const [y, m] = month.split('-').map(Number);
  const summary = useSummary(`${month}-01`, format(new Date(Date.UTC(y!, m!, 1)), 'yyyy-MM-dd'));

  const catById = useMemo(
    () => new Map((categories.data?.categories ?? []).map((c) => [c.id, c])),
    [categories.data],
  );
  const accById = useMemo(
    () => new Map((accounts.data?.accounts ?? []).map((a) => [a.id, a])),
    [accounts.data],
  );

  const sections = useMemo(() => groupByDate(txns.data?.transactions ?? []), [txns.data]);
  const flat = sections.flatMap(([date, rows]) => [{ header: true, date } as const, ...rows]);
  const txCount = txns.data?.transactions.length ?? 0;
  const assetsTotal = (accounts.data?.accounts ?? [])
    .filter((a) => a.type !== 'credit_card')
    .reduce((s, a) => s + a.balanceMinor, 0);

  const amountColor = (t: Transaction) =>
    t.type === 'expense' ? colors.expense : t.type === 'income' ? colors.income : colors.transfer;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={flat}
        keyExtractor={(item) => ('header' in item && item.header ? `h-${item.date}` : (item as Transaction).id)}
        refreshControl={<RefreshControl refreshing={txns.isRefetching} onRefresh={() => txns.refetch()} />}
        ListHeaderComponent={
          <View>
            <View style={styles.statRow}>
              <StatCard
                icon="wallet-outline"
                iconColor={colors.primary}
                label="Total balance"
                value={formatMinor(assetsTotal)}
                sub={`${accounts.data?.accounts.length ?? 0} accounts`}
              />
              <StatCard
                icon="arrow-down-circle-outline"
                iconColor={colors.income}
                label="Income this month"
                value={formatMinor(summary.data?.incomeMinor ?? 0)}
              />
              <StatCard
                icon="arrow-up-circle-outline"
                iconColor={colors.expense}
                label="Expense this month"
                value={formatMinor(summary.data?.expenseMinor ?? 0)}
              />
              <StatCard
                icon="receipt-outline"
                iconColor={colors.transfer}
                label="Transactions"
                value={String(txCount)}
                sub={txns.isLoading ? '…' : undefined}
              />
            </View>

            <View style={styles.toolbar}>
              <Searchbar
                placeholder="Search memos"
                value={q}
                onChangeText={setQ}
                style={styles.search}
              />
              <View style={styles.chips}>
                {TYPE_FILTERS.map((t) => (
                  <Chip
                    key={t}
                    selected={type === t}
                    showSelectedCheck={false}
                    onPress={() => setType(t)}
                    style={[styles.chip, type === t && { backgroundColor: theme.colors.secondaryContainer }]}
                    compact
                  >
                    {t[0]!.toUpperCase() + t.slice(1)}
                  </Chip>
                ))}
              </View>
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          if ('header' in item && item.header) {
            return (
              <Text
                variant="labelLarge"
                style={[styles.dateHeader, { color: theme.colors.secondary }, index === 0 && { marginTop: 4 }]}
              >
                {item.date}
              </Text>
            );
          }
          const t = item as Transaction;
          const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
          const acc = accById.get(t.accountId);
          const toAcc = t.toAccountId ? accById.get(t.toAccountId) : undefined;
          const ti = TYPE_ICON[t.type]!;
          return (
            <TouchableRipple onPress={() => router.push(`/transaction/${t.id}`)}>
              <View style={[styles.row, cardStyle]}>
                <View style={[styles.txIcon, { backgroundColor: ti.bg }]}>
                  <MaterialCommunityIcons
                    name={ti.icon}
                    size={18}
                    color={amountColor(t)}
                  />
                </View>
                <View style={styles.rowMain}>
                  <Text variant="bodyLarge" numberOfLines={1} style={{ fontWeight: '600' }}>
                    {t.type === 'transfer'
                      ? `${acc?.name ?? '?'} → ${toAcc?.name ?? '?'}`
                      : (cat?.name ?? 'Uncategorized')}
                  </Text>
                  <Text variant="bodySmall" style={{ opacity: 0.55 }} numberOfLines={1}>
                    {[t.type !== 'transfer' ? acc?.name : null, t.memo].filter(Boolean).join(' · ') ||
                      t.type}
                  </Text>
                </View>
                {cat && (
                  <View style={[styles.badge, { backgroundColor: `${amountColor(t)}14` }]}>
                    <Text variant="labelSmall" style={{ color: amountColor(t) }}>
                      {cat.name}
                    </Text>
                  </View>
                )}
                <Text variant="titleSmall" style={{ color: amountColor(t), fontWeight: '700', marginLeft: 12 }}>
                  {formatSigned(t.amountMinor, t.type)}
                </Text>
              </View>
            </TouchableRipple>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            {txns.isLoading ? 'Loading…' : 'No transactions yet — tap + to add one.'}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4, marginTop: 4 },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 180,
    flexGrow: 1,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F2F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: { marginTop: 14, marginBottom: 4 },
  search: { marginHorizontal: 4, borderRadius: 12, elevation: 0 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingVertical: 12 },
  chip: {},
  dateHeader: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowMain: { flex: 1, marginRight: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  empty: { textAlign: 'center', marginTop: 48, opacity: 0.6 },
});
