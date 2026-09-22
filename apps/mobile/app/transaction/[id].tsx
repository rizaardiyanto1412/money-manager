import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Divider, List, Portal, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Transaction } from '@money-manager/shared';
import { api } from '@/lib/api';
import { useAccounts, useCategories, useDeleteTransaction } from '@/lib/hooks';
import { formatMinor, formatSigned } from '@/lib/format';
import type { AppColors } from '@/theme';

export default function TransactionDetailScreen() {
  const theme = useTheme();
  const colors = theme.colors as AppColors;
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTxn = useDeleteTransaction();
  const accounts = useAccounts();
  const categories = useCategories();

  const txn = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => api<{ transaction: Transaction }>(`/api/transactions/${id}`),
  });

  const t = txn.data?.transaction;
  const acc = accounts.data?.accounts.find((a) => a.id === t?.accountId);
  const toAcc = accounts.data?.accounts.find((a) => a.id === t?.toAccountId);
  const cat = categories.data?.categories.find((c) => c.id === t?.categoryId);

  const amountColor =
    t?.type === 'expense' ? colors.expense : t?.type === 'income' ? colors.income : colors.transfer;

  const remove = async () => {
    await deleteTxn.mutateAsync(id!);
    void qc.invalidateQueries({ queryKey: ['transactions'] });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ScrollView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {t ? (
        <>
          <Card style={styles.card} mode="contained">
            <Card.Content style={styles.amountBox}>
              <Text variant="displaySmall" style={{ color: amountColor, fontWeight: '700' }}>
                {formatSigned(t.amountMinor, t.type, acc?.currency)}
              </Text>
              <Text variant="labelLarge" style={{ opacity: 0.65, textTransform: 'capitalize' }}>
                {t.type}
              </Text>
            </Card.Content>
          </Card>

          <List.Item title="Date" description={t.date} left={(p) => <List.Icon {...p} icon="calendar" />} />
          <Divider />
          {t.type === 'transfer' ? (
            <>
              <List.Item title="From" description={acc?.name} left={(p) => <List.Icon {...p} icon="wallet-outline" />} />
              <Divider />
              <List.Item title="To" description={toAcc?.name} left={(p) => <List.Icon {...p} icon="wallet-outline" />} />
            </>
          ) : (
            <>
              <List.Item title="Account" description={acc?.name} left={(p) => <List.Icon {...p} icon="wallet-outline" />} />
              <Divider />
              <List.Item title="Category" description={cat?.name ?? '—'} left={(p) => <List.Icon {...p} icon="shape-outline" />} />
            </>
          )}
          {t.memo ? (
            <>
              <Divider />
              <List.Item title="Memo" description={t.memo} left={(p) => <List.Icon {...p} icon="note-text-outline" />} />
            </>
          ) : null}

          <View style={styles.actions}>
            <Button mode="outlined" textColor={theme.colors.error} icon="delete-outline" onPress={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </View>
        </>
      ) : (
        <Text style={styles.empty} variant="bodyMedium">
          {txn.isLoading ? 'Loading…' : 'Transaction not found.'}
        </Text>
      )}

      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>Delete transaction?</Dialog.Title>
          <Dialog.Content>
            <Text>{t ? formatMinor(t.amountMinor, acc?.currency) : ''} — this can't be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={remove} loading={deleteTxn.isPending}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { margin: 12 },
  amountBox: { alignItems: 'center', paddingVertical: 16 },
  actions: { padding: 16 },
  empty: { textAlign: 'center', marginTop: 48, opacity: 0.6 },
});
