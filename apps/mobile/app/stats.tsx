import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Divider, List, ProgressBar, Text, useTheme } from 'react-native-paper';
import { format } from 'date-fns';
import { MonthNav } from '@/components/MonthNav';
import { useSummary } from '@/lib/hooks';
import { formatMinor } from '@/lib/format';
import type { AppColors } from '@/theme';

export default function StatsScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = format(new Date(Date.UTC(y!, m!, 1)), 'yyyy-MM-dd');
  const summary = useSummary(from, to);

  const data = summary.data;
  const expenseCats = useMemo(
    () =>
      (data?.byCategory ?? [])
        .filter((c) => c.kind === 'expense')
        .sort((a, b) => b.totalMinor - a.totalMinor),
    [data],
  );
  const incomeCats = useMemo(
    () =>
      (data?.byCategory ?? [])
        .filter((c) => c.kind === 'income')
        .sort((a, b) => b.totalMinor - a.totalMinor),
    [data],
  );

  const catRow = (kindTotal: number, color: string) =>
    function Row(props: { c: { categoryId: string; categoryName: string | null; totalMinor: number; count: number } }) {
      const { c } = props;
      const pct = kindTotal > 0 ? c.totalMinor / kindTotal : 0;
      return (
        <View key={c.categoryId} style={styles.catRow}>
          <View style={styles.catHeader}>
            <Text variant="bodyMedium">{c.categoryName ?? 'Uncategorized'}</Text>
            <Text variant="bodyMedium" style={{ color }}>
              {formatMinor(c.totalMinor)} · {Math.round(pct * 100)}%
            </Text>
          </View>
          <ProgressBar progress={Math.min(pct, 1)} color={color} style={styles.bar} />
        </View>
      );
    };

  return (
    <ScrollView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <MonthNav month={month} onChange={setMonth} />

      <Card style={styles.card} mode="contained">
        <Card.Content style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text variant="labelSmall" style={{ opacity: 0.6 }}>
              Income
            </Text>
            <Text variant="titleMedium" style={{ color: colors.income }}>
              {formatMinor(data?.incomeMinor ?? 0)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text variant="labelSmall" style={{ opacity: 0.6 }}>
              Expense
            </Text>
            <Text variant="titleMedium" style={{ color: colors.expense }}>
              {formatMinor(data?.expenseMinor ?? 0)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text variant="labelSmall" style={{ opacity: 0.6 }}>
              Net
            </Text>
            <Text variant="titleMedium">{formatMinor(data?.netMinor ?? 0)}</Text>
          </View>
        </Card.Content>
      </Card>

      <List.Subheader>Expenses by category</List.Subheader>
      {expenseCats.map((c) => catRow(data?.expenseMinor ?? 0, colors.expense)({ c }))}
      {expenseCats.length === 0 && <Text style={styles.empty}>No expenses this month</Text>}
      <Divider />
      <List.Subheader>Income by category</List.Subheader>
      {incomeCats.map((c) => catRow(data?.incomeMinor ?? 0, colors.income)({ c }))}
      {incomeCats.length === 0 && <Text style={styles.empty}>No income this month</Text>}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { margin: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryCell: { gap: 2 },
  catRow: { paddingHorizontal: 16, paddingVertical: 6 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  bar: { height: 6, borderRadius: 3 },
  empty: { paddingHorizontal: 16, paddingVertical: 8, opacity: 0.5 },
});
