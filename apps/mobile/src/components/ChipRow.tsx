import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export function ChipRow<T extends { id: string; name: string }>(props: {
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

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
});
