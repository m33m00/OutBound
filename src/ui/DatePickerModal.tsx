import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fromPickerDate, toPickerDate } from '@/search/dates';
import { spacing, textStyles, useColors, useColorSchemeName } from '@/theme';

import { SheetHeader } from './SheetHeader';

export interface DatePickerModalProps {
  visible: boolean;
  date: string;
  /** First and last searchable day, "YYYY-MM-DD" (0-7 days out). */
  min: string;
  max: string;
  onPick: (date: string) => void;
  onClose: () => void;
  /** Line under the calendar. */
  note?: string;
  title?: string;
}

/** Calendar for days past the quick chips (Q-045). Only 0-7 days out can be picked. */
export function DatePickerModal({
  visible,
  date,
  min,
  max,
  onPick,
  onClose,
  note = 'Search up to 7 days out.',
  title = 'Date',
}: DatePickerModalProps) {
  const c = useColors();
  const scheme = useColorSchemeName();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <SheetHeader title={title} action="Done" onAction={onClose} />
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
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>{note}</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page, gap: spacing.section },
});
