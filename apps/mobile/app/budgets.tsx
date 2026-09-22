import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  FAB,
  HelperText,
  IconButton,
  Portal,
  ProgressBar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { format } from 'date-fns';
import { ChipRow } from '@/components/ChipRow';
import { MonthNav } from '@/components/MonthNav';
import {
  useBudgets,
  useBudgetStatus,
  useCategories,
  useDeleteBudget,
  useUpsertBudget,
} from '@/lib/hooks';
import { formatMinor } from '@/lib/format';
import type { AppColors } from '@/theme';

export default function BudgetsScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const status = useBudgetStatus(month);
  const budgets = useBudgets(month);
  const categories = useCategories();
  const upsert = useUpsertBudget();
  const del = useDeleteBudget();

  const [dialog, setDialog] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const expenseCats = useMemo(
    () => (categories.data?.categories ?? []).filter((c) => c.kind === 'expense' && !c.parentId),
    [categories.data],
  );

  const budgetIdFor = (catId: string) =>
    budgets.data?.budgets.find((b) => b.categoryId === catId)?.id;

  const amountMinor = Number(amount.replace(/[^\d]/g, '') || '0');

  const save = async () => {
    setError(null);
    try {
      await upsert.mutateAsync({ categoryId: categoryId!, month, amountMinor });
      setDialog(false);
      setCategoryId(null);
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const barColor = (pct: number) =>
    pct >= 100 ? colors.expense : pct >= 80 ? '#F9A825' : colors.income;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <MonthNav month={month} onChange={setMonth} />
      <FlatList
        data={status.data?.status ?? []}
        keyExtractor={(s) => s.categoryId}
        renderItem={({ item: s }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text variant="titleSmall">{s.categoryName}</Text>
              <View style={styles.rowRight}>
                <Text variant="bodyMedium">
                  {formatMinor(s.spentMinor)} of {formatMinor(s.budgetMinor)}
                </Text>
                {budgetIdFor(s.categoryId) && (
                  <IconButton
                    icon="delete-outline"
                    size={18}
                    onPress={() => del.mutate(budgetIdFor(s.categoryId)!)}
                  />
                )}
              </View>
            </View>
            <ProgressBar
              progress={Math.min(s.percentUsed / 100, 1)}
              color={barColor(s.percentUsed)}
              style={styles.bar}
            />
            <Text variant="bodySmall" style={{ opacity: 0.6, marginTop: 4 }}>
              {s.remainingMinor >= 0
                ? `${formatMinor(s.remainingMinor)} left · ${s.percentUsed}% used`
                : `${formatMinor(-s.remainingMinor)} over · ${s.percentUsed}% used`}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No budgets for this month — tap + to add one.</Text>
        }
      />
      <FAB icon="plus" label="Budget" style={styles.fab} onPress={() => setDialog(true)} />

      <Portal>
        <Dialog visible={dialog} onDismiss={() => setDialog(false)}>
          <Dialog.Title>Budget for {format(new Date(`${month}-01`), 'MMMM yyyy')}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 420 }}>
            <View style={styles.dialogBody}>
              <ChipRow items={expenseCats} selected={categoryId} onSelect={setCategoryId} />
              <TextInput
                label="Amount (minor units)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                mode="outlined"
                style={{ marginTop: 16 }}
              />
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialog(false)}>Cancel</Button>
            <Button
              onPress={save}
              disabled={!categoryId || amountMinor <= 0 || upsert.isPending}
              loading={upsert.isPending}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { paddingHorizontal: 16, paddingVertical: 8 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  bar: { height: 6, borderRadius: 3, marginTop: 4 },
  empty: { padding: 24, opacity: 0.5, textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  dialogBody: { paddingHorizontal: 16, paddingVertical: 8 },
});
