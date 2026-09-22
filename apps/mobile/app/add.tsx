import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAccounts, useAddTransaction, useCategories } from '@/lib/hooks';
import { today } from '@/lib/format';
import type { AppColors } from '@/theme';

type TxnType = 'expense' | 'income' | 'transfer';

function ChipRow<T extends { id: string; name: string }>(props: {
  items: T[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipWrap}>
      {props.items.map((item) => {
        const active = item.id === props.selected;
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.chip,
              { borderColor: theme.colors.outline },
              active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => props.onSelect(item.id)}
          >
            <Text variant="labelLarge" style={active ? { color: '#fff' } : undefined}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AddTransactionScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const router = useRouter();
  const accounts = useAccounts();
  const categories = useCategories();
  const addTxn = useAddTransaction();

  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accountList = accounts.data?.accounts ?? [];
  const categoryList = useMemo(
    () => (categories.data?.categories ?? []).filter((c) => c.kind === type && !c.parentId),
    [categories.data, type],
  );

  const amountMinor = Number(amount.replace(/[^\d]/g, '') || '0');
  const valid =
    amountMinor > 0 &&
    accountId &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (type === 'transfer' ? toAccountId && toAccountId !== accountId : categoryId);

  const submit = async () => {
    if (!valid) return;
    setError(null);
    try {
      await addTxn.mutateAsync({
        type,
        amountMinor,
        accountId: accountId!,
        toAccountId: type === 'transfer' ? toAccountId! : undefined,
        categoryId: type === 'transfer' ? undefined : categoryId!,
        date,
        memo: memo || undefined,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => {
            setType(v as TxnType);
            setCategoryId(null);
          }}
          buttons={[
            { value: 'expense', label: 'Expense', style: type === 'expense' ? { backgroundColor: '#C6282833' } : {} },
            { value: 'income', label: 'Income', style: type === 'income' ? { backgroundColor: '#2E7D3233' } : {} },
            { value: 'transfer', label: 'Transfer', style: type === 'transfer' ? { backgroundColor: '#1565C033' } : {} },
          ]}
          style={styles.segmented}
        />

        <TextInput
          label="Amount (minor units)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          mode="outlined"
          autoFocus
          style={styles.amount}
          contentStyle={styles.amountText}
        />

        {type === 'transfer' ? (
          <>
            <Text variant="labelLarge" style={styles.section}>
              From
            </Text>
            <ChipRow items={accountList} selected={accountId} onSelect={setAccountId} />
            <Text variant="labelLarge" style={styles.section}>
              To
            </Text>
            <ChipRow items={accountList} selected={toAccountId} onSelect={setToAccountId} />
          </>
        ) : (
          <>
            <Text variant="labelLarge" style={styles.section}>
              Account
            </Text>
            <ChipRow items={accountList} selected={accountId} onSelect={setAccountId} />
            <Text variant="labelLarge" style={styles.section}>
              Category
            </Text>
            <ChipRow items={categoryList} selected={categoryId} onSelect={setCategoryId} />
          </>
        )}

        <TextInput
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
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

        <Button mode="contained" onPress={submit} loading={addTxn.isPending} disabled={!valid || addTxn.isPending}>
          Save
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 48 },
  segmented: { marginBottom: 16 },
  amount: { marginBottom: 8 },
  amountText: { fontSize: 24, fontWeight: '700' },
  section: { marginTop: 16, marginBottom: 8, opacity: 0.7 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  field: { marginTop: 16 },
});
