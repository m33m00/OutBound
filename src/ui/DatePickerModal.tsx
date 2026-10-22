import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fromPickerDate, toPickerDate } from '@/search/dates';
import { spacing, textStyles, useColors, useColorSchemeName } from '@/theme';

import { Button } from './Buttons';

export interface DatePickerModalProps {
  visible: boolean;
  date: string;
  /** First and last searchable day, "YYYY-MM-DD" (0-7 days out). */
  min: string;
  max: string;
  onPick: (date: string) => void;
  onClose: () => void;
}

/** Calendar for days past the quick chips (Q-045). Only 0-7 days out can be picked. */
export function DatePickerModal({ visible, date, min, max, onPick, onClose }: DatePickerModalProps) {
  const c = useColors();
  const scheme = useColorSchemeName();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
            Date
          </Text>
          <Button label="Done" onPress={onClose} />
        </View>
        <DateTimePicker
          value={toPickerDate(date)}
          mode="date"
          display="inline"
          minimumDate={toPickerDate(min)}
          maximumDate={toPickerDate(max)}
          accentColor={c.accent}
          themeVariant={scheme}
          onChange={(e, d) => {
            if (e.type === 'set' && d) onPick(fromPickerDate(d));
            // Android shows a dialog; a cancel there should close this sheet too.
            if (e.type === 'set' || e.type === 'dismissed') onClose();
          }}
        />
        <Text style={[textStyles.small, { color: c.muted }]}>Search up to 7 days out.</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page, gap: spacing.section },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.section,
  },
});
