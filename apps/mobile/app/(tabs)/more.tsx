import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Divider, List, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/session';

export default function MoreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useSession();

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { margin: 12 },
  logout: { margin: 16 },
});
