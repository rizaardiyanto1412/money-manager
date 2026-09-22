import { useState } from 'react';
import { FlatList, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Checkbox,
  Dialog,
  FAB,
  HelperText,
  IconButton,
  List,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type { ApiKey } from '@money-manager/shared';
import { api } from '@/lib/api';

export default function ApiKeysScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState('');
  const [writeScope, setWriteScope] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keys = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => api<{ apiKeys: ApiKey[] }>('/api/api-keys'),
  });

  const createKey = useMutation({
    mutationFn: (input: { name: string; scopes: string[] }) =>
      api<{ apiKey: ApiKey & { key: string } }>('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      setNewKey(data.apiKey.key);
      void qc.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => api(`/api/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['apiKeys'] }),
  });

  const create = async () => {
    setError(null);
    await createKey.mutateAsync({ name: name.trim(), scopes: writeScope ? ['read', 'write'] : ['read'] });
    setName('');
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Text variant="bodySmall" style={styles.hint}>
        Use a key as MONEY_MANAGER_API_KEY for the MCP server, or as a Bearer token on POST /mcp.
      </Text>

      <FlatList
        data={keys.data?.apiKeys ?? []}
        keyExtractor={(k) => k.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${item.scopes.join(', ')} · created ${item.createdAt.slice(0, 10)}`}
            left={(p) => <List.Icon {...p} icon="key-outline" />}
            right={() => (
              <IconButton icon="delete-outline" onPress={() => revokeKey.mutate(item.id)} />
            )}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty} variant="bodyMedium">
            {keys.isLoading ? 'Loading…' : 'No keys yet.'}
          </Text>
        }
      />

      <Portal>
        <Dialog visible={showDialog && !newKey} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>New API key</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" style={styles.field} />
            <Checkbox.Item
              label="Allow writes (add transactions)"
              status={writeScope ? 'checked' : 'unchecked'}
              onPress={() => setWriteScope((v) => !v)}
              position="leading"
            />
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancel</Button>
            <Button onPress={create} disabled={!name.trim() || createKey.isPending}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!newKey} onDismiss={() => { setNewKey(null); setShowDialog(false); }}>
          <Dialog.Title>Key created — copy it now</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.keyBox}>
              <Text variant="bodySmall" selectable style={{ fontFamily: 'monospace' as never }}>
                {newKey}
              </Text>
            </ScrollView>
            <Text variant="bodySmall" style={{ opacity: 0.65 }}>
              Shown once. Store it as MONEY_MANAGER_API_KEY.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => Share.share({ message: newKey! })}>Share</Button>
            <Button onPress={() => { setNewKey(null); setShowDialog(false); }}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB icon="plus" style={styles.fab} onPress={() => setShowDialog(true)} label="API key" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { padding: 16, opacity: 0.65 },
  field: { marginBottom: 8 },
  keyBox: { maxHeight: 120, padding: 8, borderRadius: 6, marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 48, opacity: 0.6 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
