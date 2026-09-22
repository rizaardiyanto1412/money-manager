import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { darkTheme, lightTheme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

function AuthGate() {
  const { user, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)');
  }, [user, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add" options={{ title: 'Add transaction', headerShown: true, presentation: 'card' }} />
      <Stack.Screen name="stats" options={{ title: 'Statistics', headerShown: true }} />
      <Stack.Screen name="budgets" options={{ title: 'Budgets', headerShown: true }} />
      <Stack.Screen name="recurring" options={{ title: 'Recurring', headerShown: true }} />
      <Stack.Screen name="bookmarks" options={{ title: 'Bookmarks', headerShown: true }} />
      <Stack.Screen name="categories" options={{ title: 'Categories', headerShown: true }} />
      <Stack.Screen name="api-keys" options={{ title: 'API Keys', headerShown: true }} />
      <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction', headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={scheme === 'dark' ? darkTheme : lightTheme}>
          <SessionProvider>
            <AuthGate />
          </SessionProvider>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
