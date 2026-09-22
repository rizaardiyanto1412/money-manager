import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { addMonths, format, parseISO } from 'date-fns';

/** YYYY-MM month pager. */
export function MonthNav(props: { month: string; onChange: (month: string) => void }) {
  const date = parseISO(`${props.month}-01`);
  return (
    <View style={styles.row}>
      <IconButton
        icon="chevron-left"
        onPress={() => props.onChange(format(addMonths(date, -1), 'yyyy-MM'))}
      />
      <Text variant="titleMedium">{format(date, 'MMMM yyyy')}</Text>
      <IconButton
        icon="chevron-right"
        onPress={() => props.onChange(format(addMonths(date, 1), 'yyyy-MM'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
});
