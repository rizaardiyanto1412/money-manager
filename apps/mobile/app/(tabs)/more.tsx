import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Divider, List, Snackbar, Text, useTheme } from 'react-native-paper';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/session';
import { exportTransactionsCsv } from '@/lib/export';

export default function MoreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useSession();
  const [toast, setToast] = useState<string | null>(null);

  const doExport = async () => {
    try {
      await exportTransactionsCsv();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Export failed');
    }
  };

  return (
    <ScrollView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card} mode="contained">
        <Card.Content>
          <Text variant="titleMedium">{user?.name}</Text>
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>
            {user?.email}
          </Text>
        </Card.Content>
      </Card>

      <List.Item
        title="Statistics"
        description="Spending breakdown by month"
        left={(p) => <List.Icon {...p} icon="chart-pie" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => router.push('/stats')}
      />
      <Divider />
      <List.Item
        title="Budgets"
        description="Per-category monthly limits"
        left={(p) => <List.Icon {...p} icon="wallet-outline" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => router.push('/budgets')}
      />
      <Divider />
      <List.Item
        title="Recurring"
        description="Automatic repeating transactions"
        left={(p) => <List.Icon {...p} icon="repeat" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => router.push('/recurring')}
      />
      <Divider />
      <List.Item
        title="Bookmarks"
        description="One-tap frequent expenses"
        left={(p) => <List.Icon {...p} icon="bookmark-outline" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => router.push('/bookmarks')}
      />
      <Divider />
      <List.Item
        title="Categories"
        description="Manage income/expense categories"
        left={(p) => <List.Icon {...p} icon="shape-outline" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => router.push('/categories')}
      />
      <Divider />
      <List.Item
        title="Import"
        description="Money Manager (Realbyte) Excel/CSV backup"
        left={(p) => <List.Icon {...p} icon="database-import-outline" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => router.push('/import')}
      />
      <Divider />
      <List.Item
        title="Export CSV"
        description="Download all transactions as CSV"
        left={(p) => <List.Icon {...p} icon="download-outline" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={doExport}
      />
      <Divider />
      <List.Item
        title="API keys"
        description="Keys for the MCP server & agents"
        left={(p) => <List.Icon {...p} icon="key-outline" />}
        right={(p) => <List.Icon {...p} icon="chevron-right" />}
        onPress={() => router.push('/api-keys')}
      />
      <Divider />

      <Button mode="outlined" onPress={logout} style={styles.logout} icon="logout">
        Sign out
      </Button>
      <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={3000}>
        {toast}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { margin: 12 },
  logout: { margin: 16 },
});
