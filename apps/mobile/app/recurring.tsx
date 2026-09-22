import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  FAB,
  HelperText,
  IconButton,
  List,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { ChipRow } from '@/components/ChipRow';
import {
  useAccounts,
  useAddRecurring,
  useCategories,
  useDeleteRecurring,
  useRecurring,
  useUpdateRecurring,
} from '@/lib/hooks';
import { formatSigned, today } from '@/lib/format';
import type { AppColors } from '@/theme';

type TxnType = 'expense' | 'income' | 'transfer';
const FREQS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

function humanRrule(rrule: string): string {
  const freq = /FREQ=(\w+)/.exec(rrule)?.[1];
  return freq ? freq.charAt(0) + freq.slice(1).toLowerCase() : rrule;
}

export default function RecurringScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const recurring = useRecurring();
  const accounts = useAccounts();
  const categories = useCategories();
  const add = useAddRecurring();
  const update = useUpdateRecurring();
  const del = useDeleteRecurring();

  const [dialog, setDialog] = useState(false);
  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [freq, setFreq] = useState('MONTHLY');
  const [startDate, setStartDate] = useState(today());
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accountName = (id: string) =>
    accounts.data?.accounts.find((a) => a.id === id)?.name ?? '?';
  const categoryName = (id: string | null) =>
    id ? categories.data?.categories.find((c) => c.id === id)?.name ?? '?' : null;

  const accountList = accounts.data?.accounts ?? [];
  const categoryList = useMemo(
    () => (categories.data?.categories ?? []).filter((c) => c.kind === type && !c.parentId),
    [categories.data, type],
  );
  const amountMinor = Number(amount.replace(/[^\d]/g, '') || '0');
  const valid =
    amountMinor > 0 && accountId && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && (type === 'transfer' || categoryId);

  const save = async () => {
    if (!valid) return;
    setError(null);
    try {
      await add.mutateAsync({
        type,
        amountMinor,
        accountId: accountId!,
        categoryId: type === 'transfer' ? null : categoryId!,
        memo: memo || null,
        rrule: `FREQ=${freq};INTERVAL=1`,
        nextRunDate: startDate,
      });
      setDialog(false);
      setAmount('');
      setMemo('');
      setCategoryId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={recurring.data?.recurring ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item: r }) => (
          <List.Item
            title={r.memo ?? categoryName(r.categoryId) ?? accountName(r.accountId)}
            description={`${humanRrule(r.rrule)} · next ${r.nextRunDate} · ${accountName(r.accountId)}`}
            right={() => (
              <View style={styles.right}>
                <Text
                  variant="titleSmall"
                  style={{ color: r.type === 'expense' ? colors.expense : colors.income }}
                >
                  {formatSigned(r.amountMinor, r.type)}
                </Text>
                <Switch
                  value={r.active}
                  onValueChange={(v) => update.mutate({ id: r.id, active: v })}
                />
                <IconButton icon="delete-outline" size={20} onPress={() => del.mutate(r.id)} />
              </View>
            )}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No recurring transactions yet — e.g. monthly rent or salary.
          </Text>
        }
      />
      <FAB icon="plus" label="Recurring" style={styles.fab} onPress={() => setDialog(true)} />

      <Portal>
        <Dialog visible={dialog} onDismiss={() => setDialog(false)}>
          <Dialog.Title>New recurring transaction</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 480 }}>
            <View style={styles.dialogBody}>
              <SegmentedButtons
                value={type}
                onValueChange={(v) => {
                  setType(v as TxnType);
                  setCategoryId(null);
                }}
                buttons={[
                  { value: 'expense', label: 'Expense' },
                  { value: 'income', label: 'Income' },
                ]}
              />
              <TextInput
                label="Amount (minor units)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.field}
              />
              <Text variant="labelLarge" style={styles.section}>
                Account
              </Text>
              <ChipRow items={accountList} selected={accountId} onSelect={setAccountId} />
              {type !== 'transfer' && (
                <>
                  <Text variant="labelLarge" style={styles.section}>
                    Category
                  </Text>
                  <ChipRow items={categoryList} selected={categoryId} onSelect={setCategoryId} />
                </>
              )}
              <Text variant="labelLarge" style={styles.section}>
                Frequency
              </Text>
              <SegmentedButtons
                value={freq}
                onValueChange={setFreq}
                buttons={FREQS}
                density="small"
              />
              <TextInput
                label="First date (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                mode="outlined"
                style={styles.field}
              />
              <TextInput
                label="Memo"
                value={memo}
                onChangeText={setMemo}
                mode="outlined"
                style={styles.field}
              />
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialog(false)}>Cancel</Button>
            <Button onPress={save} disabled={!valid || add.isPending} loading={add.isPending}>
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
  right: { flexDirection: 'row', alignItems: 'center' },
  empty: { padding: 24, opacity: 0.5, textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  dialogBody: { paddingHorizontal: 16, paddingVertical: 8 },
  field: { marginTop: 12 },
  section: { marginTop: 12, marginBottom: 8, opacity: 0.7 },
});
