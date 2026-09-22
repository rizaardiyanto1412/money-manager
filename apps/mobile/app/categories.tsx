import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  FAB,
  IconButton,
  List,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAddCategory, useCategories, useDeleteCategory } from '@/lib/hooks';

export default function CategoriesScreen() {
  const theme = useTheme();
  const categories = useCategories();
  const addCategory = useAddCategory();
  const deleteCategory = useDeleteCategory();
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [deleting, setDeleting] = useState<string | null>(null);

  const all = categories.data?.categories ?? [];
  const sections = [
    { title: 'Expense', data: all.filter((c) => c.kind === 'expense') },
    { title: 'Income', data: all.filter((c) => c.kind === 'income') },
  ];

  const create = async () => {
    await addCategory.mutateAsync({ name: name.trim(), kind });
    setShowDialog(false);
    setName('');
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        renderSectionHeader={({ section }) => (
          <Text variant="labelLarge" style={[styles.header, { backgroundColor: theme.colors.background }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={item.parentId ? 'Subcategory' : undefined}
            left={(p) => <List.Icon {...p} icon={item.kind === 'expense' ? 'cart-outline' : 'cash-plus'} />}
            right={() => (
              <IconButton icon="delete-outline" onPress={() => setDeleting(item.id)} />
            )}
          />
        )}
      />

      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>New category</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" style={styles.field} />
            <SegmentedButtons
              value={kind}
              onValueChange={(v) => setKind(v as 'expense' | 'income')}
              buttons={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancel</Button>
            <Button onPress={create} disabled={!name.trim() || addCategory.isPending}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!deleting} onDismiss={() => setDeleting(null)}>
          <Dialog.Title>Delete category?</Dialog.Title>
          <Dialog.Content>
            <Text>Transactions keep their records but lose this category link.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleting(null)}>Cancel</Button>
            <Button
              textColor={theme.colors.error}
              onPress={async () => {
                await deleteCategory.mutateAsync(deleting!);
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB icon="plus" style={styles.fab} onPress={() => setShowDialog(true)} label="Category" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 8, opacity: 0.7 },
  field: { marginBottom: 12 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
