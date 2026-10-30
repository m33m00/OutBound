import { useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pickerSections, type PickerItem } from '@/search/airports';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { selectionTick } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { SheetHeader } from './SheetHeader';

export interface AirportPickerProps {
  visible: boolean;
  title: string;
  onPick: (code: string) => void;
  onClose: () => void;
  /** Airport shown with a check (the one being changed). */
  current?: string | null;
  /** Quick picks above the full list (design round 3). */
  nearest?: string | null;
  homes?: readonly { code: string; main: boolean }[];
}

export function AirportPicker({ visible, title, onPick, onClose, current, nearest, homes }: AirportPickerProps) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const sections = pickerSections(query, { nearest, homes });
  const empty = sections.every((s) => s.data.length === 0);
  // Same tick as every other pick (design round 10).
  const pick = (code: string) => {
    selectionTick();
    setQuery('');
    onPick(code);
  };
  // Return picks the top match once something is typed (design round 29).
  const topMatch = query.trim() ? sections.find((s) => s.data.length)?.data[0]?.airport.code : undefined;

  const close = () => {
    setQuery('');
    onClose();
  };

  const renderItem = ({ item }: { item: PickerItem }) => {
    const { airport, tag } = item;
    const on = airport.code === current;
    return (
      <Pressable
        onPress={() => pick(airport.code)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={[airport.code, airport.name, tag].filter(Boolean).join(', ')}
        style={pressStyle([styles.item, { borderColor: c.line }])}>
        <Text style={[textStyles.number, styles.code, { color: c.text }]}>{airport.code}</Text>
        <Text style={[textStyles.body, styles.name, { color: c.muted }]} numberOfLines={2}>
          {airport.name}
        </Text>
        {tag ? (
          // Amber = "you" (DECISIONS.md): your homes and where you are.
          <View style={[styles.tag, { backgroundColor: c.youBg }]}>
            <Text style={[textStyles.small, { color: c.youText }]}>{tag}</Text>
          </View>
        ) : null}
        {on ? (
          <Icon
            name="checkmark"
            size={16}
            weight="semibold"
            tintColor={c.accent}
            fallback={<Text style={[textStyles.bodyStrong, { color: c.accent }]}>✓</Text>}
          />
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <SheetHeader title={title} action="Cancel" onAction={close} />
        <View style={[styles.input, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="magnifyingglass" size={16} tintColor={c.faint} fallback={null} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Airport code or city"
            placeholderTextColor={c.faint}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType={topMatch ? 'go' : 'done'}
            onSubmitEditing={() => topMatch && pick(topMatch)}
            accessibilityLabel="Search airports"
            style={[textStyles.body, styles.field, { color: c.text }]}
          />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.tag ? 'quick' : 'all'}-${item.airport.code}-${i}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          renderItem={renderItem}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text
                style={[textStyles.small, styles.sectionTitle, { color: c.muted }]}
                accessibilityRole="header">
                {section.title.toUpperCase()}
              </Text>
            ) : null
          }
          // A typed query with no match still has one (empty) section, so this is a footer.
          ListFooterComponent={
            empty ? (
              <Text style={[textStyles.body, styles.empty, { color: c.muted }]}>
                No airports match “{query.trim()}”.
              </Text>
            ) : undefined
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  input: {
    minHeight: minTapTarget,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.rowX,
    marginBottom: spacing.group,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
  },
  field: { flex: 1, minHeight: minTapTarget },
  sectionTitle: { letterSpacing: 0.6, paddingTop: spacing.page, paddingBottom: 4 },
  item: {
    minHeight: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.section,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.rowY,
  },
  code: { minWidth: 52 },
  name: { flex: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  empty: { paddingVertical: spacing.page },
});
