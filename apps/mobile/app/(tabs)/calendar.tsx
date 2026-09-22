import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Divider, IconButton, List, Text, useTheme } from 'react-native-paper';
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import type { Transaction } from '@money-manager/shared';
import { useCategories, useDaily, useTransactions } from '@/lib/hooks';
import { formatMinor, formatSigned } from '@/lib/format';
import type { AppColors } from '@/theme';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [selected, setSelected] = useState<string | null>(null);

  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const to = format(new Date(Date.UTC(y!, m!, 1)), 'yyyy-MM-dd');

  const daily = useDaily(from, to);
  const txns = useTransactions(selected ? { from: selected, to: selected } : { from, to });
  const categories = useCategories();

  const catById = useMemo(
    () => new Map((categories.data?.categories ?? []).map((c) => [c.id, c])),
    [categories.data],
  );

  const dailyMap = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const d of daily.data?.days ?? []) {
      map.set(d.date, { income: d.incomeMinor, expense: d.expenseMinor });
    }
    return map;
  }, [daily.data]);

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(new Date(`${from}T00:00:00`)));
    const end = endOfWeek(endOfMonth(new Date(`${from}T00:00:00`)));
    const rows: string[][] = [];
    let cursor = start;
    while (cursor <= end) {
      const week: string[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(format(cursor, 'yyyy-MM-dd'));
        cursor = addDays(cursor, 1);
      }
      rows.push(week);
    }
    return rows;
  }, [from]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(y!, m! - 1 + delta, 1));
    setMonth(format(next, 'yyyy-MM'));
    setSelected(null);
  };

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const v of dailyMap.values()) {
      income += v.income;
      expense += v.expense;
    }
    return { income, expense };
  }, [dailyMap]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.monthBar}>
        <IconButton icon="chevron-left" onPress={() => shiftMonth(-1)} />
        <Text variant="titleMedium" style={styles.monthTitle}>
          {format(new Date(`${from}T00:00:00`), 'MMMM yyyy')}
        </Text>
        <IconButton icon="chevron-right" onPress={() => shiftMonth(1)} />
      </View>

      <View style={styles.totalsRow}>
        <Text variant="labelMedium" style={{ color: colors.income }}>
          Inc {formatMinor(totals.income)}
        </Text>
        <Text variant="labelMedium" style={{ color: colors.expense }}>
          Exp {formatMinor(totals.expense)}
        </Text>
        <Text variant="labelMedium">Net {formatMinor(totals.income - totals.expense)}</Text>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} variant="labelSmall" style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day) => {
            const inMonth = day.slice(0, 7) === month;
            const agg = dailyMap.get(day);
            const isSelected = day === selected;
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayCell,
                  isSelected && { backgroundColor: theme.colors.primaryContainer },
                ]}
                onPress={() => setSelected(isSelected ? null : day)}
              >
                <Text
                  variant="labelSmall"
                  style={[styles.dayNum, { opacity: inMonth ? 1 : 0.3 }]}
                >
                  {Number(day.slice(8))}
                </Text>
                {agg && agg.income > 0 && (
                  <Text style={[styles.dayAmount, { color: colors.income }]} numberOfLines={1}>
                    {formatMinor(agg.income).replace('Rp ', '')}
                  </Text>
                )}
                {agg && agg.expense > 0 && (
                  <Text style={[styles.dayAmount, { color: colors.expense }]} numberOfLines={1}>
                    {formatMinor(agg.expense).replace('Rp ', '')}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <Divider style={styles.divider} />

      <ScrollView style={styles.txnList}>
        {(txns.data?.transactions ?? []).map((t: Transaction) => (
          <List.Item
            key={t.id}
            title={
              t.type === 'transfer'
                ? 'Transfer'
                : (t.categoryId ? catById.get(t.categoryId)?.name : null) ?? 'Uncategorized'
            }
            description={t.memo ?? undefined}
            right={() => (
              <Text
                variant="bodyMedium"
                style={{
                  color:
                    t.type === 'expense' ? colors.expense : t.type === 'income' ? colors.income : colors.transfer,
                }}
              >
                {formatSigned(t.amountMinor, t.type)}
              </Text>
            )}
          />
        ))}
        {!txns.isLoading && (txns.data?.transactions ?? []).length === 0 && (
          <Text style={styles.empty} variant="bodyMedium">
            No transactions{selected ? ` on ${selected}` : ' this month'}.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  monthTitle: { fontWeight: '700' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', opacity: 0.5, paddingVertical: 4 },
  dayCell: { flex: 1, minHeight: 52, borderRadius: 6, padding: 2, alignItems: 'center' },
  dayNum: { fontWeight: '600' },
  dayAmount: { fontSize: 8, fontWeight: '600' },
  divider: { marginTop: 8 },
  txnList: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 24, opacity: 0.6 },
});
