import { Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SearchFilters } from '@/settings/settings';
import { spacing, useColors } from '@/theme';

import { Button } from './Buttons';
import { FiltersForm } from './FiltersForm';
import { SheetHeader } from './SheetHeader';

export interface FiltersModalProps {
  visible: boolean;
  filters: SearchFilters;
  /** Saved defaults (settings); "Reset to Defaults" returns to these. */
  defaults: SearchFilters;
  onChange: (f: SearchFilters) => void;
  onClose: () => void;
}

/** Per-search filters. Starts from the saved defaults in Settings. */
export function FiltersModal({ visible, filters, defaults, onChange, onClose }: FiltersModalProps) {
  const c = useColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <SheetHeader title="Filters" action="Done" onAction={onClose} />
        <ScrollView contentContainerStyle={styles.body}>
          <FiltersForm filters={filters} onChange={onChange} />
          <Button label="Reset to Defaults" kind="secondary" onPress={() => onChange(defaults)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page },
});
