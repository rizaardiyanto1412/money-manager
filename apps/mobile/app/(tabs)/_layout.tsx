import { Slot, Tabs, usePathname, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ColorValue,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSession } from '@/lib/session';
import { contentWidth } from '@/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) =>
    <MaterialCommunityIcons name={name} color={color as string} size={size} />;

const NAV: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Transactions', icon: 'format-list-bulleted' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar-month-outline' },
  { path: '/accounts', label: 'Accounts', icon: 'wallet-outline' },
  { path: '/more', label: 'More', icon: 'dots-horizontal-circle-outline' },
];

function Sidebar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <View style={[styles.sidebar, { borderRightColor: theme.colors.outlineVariant }]}>
      <View style={styles.brand}>
        <View style={[styles.brandMark, { backgroundColor: theme.colors.primary }]}>
          <MaterialCommunityIcons name="wallet" color="#fff" size={20} />
        </View>
        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
          Money Manager
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/add')}
      >
        <MaterialCommunityIcons name="plus" color="#fff" size={20} />
        <Text style={styles.addBtnText}>Add transaction</Text>
      </TouchableOpacity>

      <Text variant="labelSmall" style={styles.menuLabel}>
        MENU
      </Text>
      {NAV.map((item) => {
        const active = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
        return (
          <TouchableOpacity
            key={item.path}
            style={[styles.navItem, active && { backgroundColor: theme.colors.secondaryContainer }]}
            onPress={() => router.push(item.path as never)}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={20}
              color={active ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text
              variant="bodyMedium"
              style={[styles.navLabel, active && { color: theme.colors.primary, fontWeight: '600' }]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.spacer} />
      {user && (
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '600' }}>
              {user.name || user.email}
            </Text>
            {user.name ? (
              <Text variant="bodySmall" numberOfLines={1} style={{ opacity: 0.55 }}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  if (width >= 920) {
    return (
      <View style={[styles.wideRoot, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.appFrame, { maxWidth: contentWidth + 260 }]}>
          <Sidebar />
          <View style={styles.content}>
            <View style={styles.contentInner}>
              <Slot />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Transactions',
          tabBarIcon: icon('format-list-bulleted'),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: icon('calendar-month'),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarButton: () => (
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push('/add')}
              accessibilityLabel="Add transaction"
            >
              <MaterialCommunityIcons name="plus" color="#fff" size={28} />
            </TouchableOpacity>
          ),
        }}
        listeners={{
          tabPress: (e) => e.preventDefault(),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: icon('wallet-outline'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: icon('dots-horizontal'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wideRoot: { flex: 1, alignItems: 'center' },
  appFrame: { flex: 1, flexDirection: 'row', width: '100%' },
  sidebar: {
    width: 236,
    paddingTop: 22,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, marginBottom: 20 },
  brandMark: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    marginBottom: 18,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  menuLabel: { opacity: 0.5, letterSpacing: 1, paddingHorizontal: 10, marginBottom: 6 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  navLabel: { fontSize: 14 },
  spacer: { flex: 1 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginBottom: 14,
    borderRadius: 10,
  },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  contentInner: { flex: 1, paddingHorizontal: 24, paddingTop: 18 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
