import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  FAB,
  List,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAccounts, useAddAccount } from '@/lib/hooks';
import { formatMinor } from '@/lib/format';

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'other', label: 'Other' },
];

export default function AccountsScreen() {
  const theme = useTheme();
  const accounts = useAccounts();
  const addAccount = useAddAccount();
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [balance, setBalance] = useState('0');

  const create = async () => {
    const minor = Math.round(Number(balance.replace(/[^\d-]/g, '') || '0'));
    await addAccount.mutateAsync({ name: name.trim(), type, initialBalanceMinor: minor });
    setShowDialog(false);
    setName('');
    setBalance('0');
  };

  const total = (accounts.data?.accounts ?? [])
    .filter((a) => a.type !== 'credit_card')
    .reduce((s, a) => s + a.balanceMinor, 0);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.totalCard} mode="contained">
        <Card.Content>
          <Text variant="labelMedium" style={{ opacity: 0.65 }}>
            Total assets
          </Text>
          <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
            {formatMinor(total)}
          </Text>
        </Card.Content>
      </Card>

      <FlatList
        data={accounts.data?.accounts ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={ACCOUNT_TYPES.find((t) => t.value === item.type)?.label ?? item.type}
            left={(props) => (
              <List.Icon
                {...props}
                icon={
                  item.type === 'cash' ? 'cash' : item.type === 'credit_card' ? 'credit-card-outline' : 'bank-outline'
                }
              />
            )}
            right={() => (
              <Text variant="titleSmall" style={styles.balance}>
                {formatMinor(item.balanceMinor, item.currency)}
              </Text>
            )}
          />
        )}
      />

      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>New account</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" style={styles.field} />
            <SegmentedButtons
              value={type}
              onValueChange={setType}
              buttons={ACCOUNT_TYPES}
              style={styles.field}
            />
            <TextInput
              label="Initial balance (minor units)"
              value={balance}
              onChangeText={setBalance}
              keyboardType="numeric"
              mode="outlined"
              style={styles.field}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancel</Button>
            <Button onPress={create} disabled={!name.trim() || addAccount.isPending}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB icon="plus" style={styles.fab} onPress={() => setShowDialog(true)} label="Account" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  totalCard: { margin: 12 },
  balance: { alignSelf: 'center', paddingRight: 8 },
  field: { marginBottom: 12 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
