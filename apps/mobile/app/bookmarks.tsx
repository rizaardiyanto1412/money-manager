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
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { ChipRow } from '@/components/ChipRow';
import {
  useAccounts,
  useAddBookmark,
  useAddTransaction,
  useBookmarks,
  useCategories,
  useDeleteBookmark,
} from '@/lib/hooks';
import { formatSigned, today } from '@/lib/format';
import type { AppColors } from '@/theme';

type TxnType = 'expense' | 'income' | 'transfer';

export default function BookmarksScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const bookmarks = useBookmarks();
  const accounts = useAccounts();
  const categories = useCategories();
  const add = useAddBookmark();
  const del = useDeleteBookmark();
  const addTxn = useAddTransaction();

  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
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
  const valid = name.trim().length > 0 && amountMinor > 0 && accountId && (type === 'transfer' || categoryId);

  const apply = async (id: string) => {
    const b = bookmarks.data?.bookmarks.find((x) => x.id === id);
    if (!b) return;
    await addTxn.mutateAsync({
      type: b.type,
      amountMinor: b.amountMinor,
      accountId: b.accountId,
      toAccountId: b.toAccountId ?? undefined,
      categoryId: b.categoryId ?? undefined,
      date: today(),
      memo: b.memo ?? undefined,
    });
    setToast(`Added "${b.name}" for today`);
  };

  const save = async () => {
    if (!valid) return;
    setError(null);
    try {
      await add.mutateAsync({
        name: name.trim(),
        type,
        amountMinor,
        accountId: accountId!,
        categoryId: type === 'transfer' ? null : categoryId!,
        memo: memo || null,
      });
      setDialog(false);
      setName('');
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
        data={bookmarks.data?.bookmarks ?? []}
        keyExtractor={(b) => b.id}
        renderItem={({ item: b }) => (
          <List.Item
            title={b.name}
            description={`${accountName(b.accountId)}${categoryName(b.categoryId) ? ` · ${categoryName(b.categoryId)}` : ''}`}
            onPress={() => apply(b.id)}
            right={() => (
              <View style={styles.right}>
                <Text
                  variant="titleSmall"
                  style={{ color: b.type === 'expense' ? colors.expense : colors.income }}
                >
                  {formatSigned(b.amountMinor, b.type)}
                </Text>
                <IconButton icon="delete-outline" size={20} onPress={() => del.mutate(b.id)} />
              </View>
            )}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No bookmarks — save frequent expenses to add them in one tap.
          </Text>
        }
      />
      <FAB icon="plus" label="Bookmark" style={styles.fab} onPress={() => setDialog(true)} />

      <Portal>
        <Dialog visible={dialog} onDismiss={() => setDialog(false)}>
          <Dialog.Title>New bookmark</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 480 }}>
            <View style={styles.dialogBody}>
              <TextInput
                label="Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                placeholder="e.g. Morning coffee"
              />
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
                style={styles.field}
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
              <Text variant="labelLarge" style={styles.section}>
                Category
              </Text>
              <ChipRow items={categoryList} selected={categoryId} onSelect={setCategoryId} />
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

      <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={2500}>
        {toast}
      </Snackbar>
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
