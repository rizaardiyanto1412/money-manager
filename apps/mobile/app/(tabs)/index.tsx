import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Card, Chip, Divider, IconButton, Searchbar, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import type { Transaction } from '@money-manager/shared';
import { useAccounts, useCategories, useTransactions, type TxnFilters } from '@/lib/hooks';
import { formatMinor, formatSigned } from '@/lib/format';
import type { AppColors } from '@/theme';

const TYPE_FILTERS = ['all', 'expense', 'income', 'transfer'] as const;

function groupByDate(rows: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const t of rows) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
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
            <Card style={styles.balanceCard} mode="contained">
              <Card.Content style={styles.balanceRow}>
                {(accounts.data?.accounts ?? []).slice(0, 4).map((a) => (
                  <View key={a.id} style={styles.balanceItem}>
                    <Text variant="labelSmall" style={{ opacity: 0.65 }} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text variant="titleSmall">{formatMinor(a.balanceMinor, a.currency)}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>

            <Searchbar placeholder="Search memos" value={q} onChangeText={setQ} style={styles.search} />
            <View style={styles.chips}>
              {TYPE_FILTERS.map((t) => (
                <Chip
                  key={t}
                  selected={type === t}
                  showSelectedCheck={false}
                  onPress={() => setType(t)}
                  style={styles.chip}
                  compact
                >
                  {t[0]!.toUpperCase() + t.slice(1)}
                </Chip>
              ))}
            </View>
            <Divider />
          </View>
        }
        renderItem={({ item }) => {
          if ('header' in item && item.header) {
            return (
              <Text variant="labelLarge" style={[styles.dateHeader, { color: theme.colors.secondary }]}>
                {item.date}
              </Text>
            );
          }
          const t = item as Transaction;
          const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
          const acc = accById.get(t.accountId);
          const toAcc = t.toAccountId ? accById.get(t.toAccountId) : undefined;
          return (
            <>
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <Text variant="bodyLarge" numberOfLines={1}>
                    {t.type === 'transfer'
                      ? `${acc?.name ?? '?'} → ${toAcc?.name ?? '?'}`
                      : (cat?.name ?? 'Uncategorized')}
                  </Text>
                  <Text variant="bodySmall" style={{ opacity: 0.6 }} numberOfLines={1}>
                    {[t.type !== 'transfer' ? acc?.name : null, t.memo].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text variant="bodyLarge" style={{ color: amountColor(t), fontWeight: '600' }}>
                  {formatSigned(t.amountMinor, t.type)}
                </Text>
                <IconButton
                  icon="chevron-right"
                  size={18}
                  onPress={() => router.push(`/transaction/${t.id}`)}
                />
              </View>
              <Divider />
            </>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            {txns.isLoading ? 'Loading…' : 'No transactions yet — tap + to add one.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balanceCard: { margin: 12, marginBottom: 4 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  balanceItem: { flex: 1 },
  search: { margin: 12, marginTop: 8 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  chip: {},
  dateHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, paddingVertical: 10 },
  rowMain: { flex: 1, marginRight: 8 },
  empty: { textAlign: 'center', marginTop: 48, opacity: 0.6 },
});
