import { useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { placeLabel } from '@/engine';
import { pickerSections, type PickerItem } from '@/search/airports';
import { rememberAirport, useRecentAirports } from '@/search/recentAirports';
import { fonts, minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { AirportSummarySheet } from './AirportSummary';
import { useCardSurface } from './cardSurface';
import { selectionTick } from './haptics';
import { Icon } from './Icon';
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
  /** Airports not offered at all: the other end's area (round 138, John). */
  exclude?: readonly string[];
}

export function AirportPicker({ visible, title, onPick, onClose, current, nearest, homes, exclude }: AirportPickerProps) {
  const c = useColors();
  const searchCard = useCardSurface({ lift: false });
  const [query, setQuery] = useState('');
  // Hold a row for its airport summary (round 174); the sheet lives inside this modal so it can open over it.
  const [info, setInfo] = useState<string | null>(null);
  const recent = useRecentAirports();
  const sections = pickerSections(query, { nearest, homes, recent, exclude });
  const empty = sections.every((s) => s.data.length === 0);
  // Same tick as every other pick (design round 10).
  const pick = (code: string) => {
    selectionTick();
    setQuery('');
    rememberAirport(code);
    onPick(code);
  };
  // Return picks the top match once something is typed (design round 29).
  const topMatch = query.trim() ? sections.find((s) => s.data.length)?.data[0]?.airport.code : undefined;

  const close = () => {
    setQuery('');
    onClose();
  };

  // Plain rows on the sheet, no card or outline around them (round 214, John: "Fix all of them"), with
  // hairlines between that start at the airport's name.
  const renderItem = ({ item, index }: { item: PickerItem; index: number }) => {
    const { airport, tag } = item;
    const on = airport.code === current;
    const first = index === 0;
    const place = placeLabel(airport.code);
    // The airport's own name on top and the city under it, so "Atlanta" isn't said twice (round 214).
    const name = airport.airportName ?? airport.name;
    return (
      <Pressable
        onPress={() => pick(airport.code)}
        onLongPress={() => {
          selectionTick();
          setInfo(airport.code);
        }}
        delayLongPress={350}
        accessibilityActions={[{ name: 'airportInfo', label: 'Airport info' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'airportInfo') setInfo(airport.code);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={[airport.code, name, place !== airport.code ? place : null, tag].filter(Boolean).join(', ')}
        testID="airport-row"
        style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.surface2 }]}>
        {first ? null : <View style={[styles.sep, { backgroundColor: c.line }]} />}
        {/* The code on its own in boarding blue, no bubble (round 214). */}
        <Text style={[styles.code, { color: c.accent }]} maxFontSizeMultiplier={1.4} testID="airport-code">
          {airport.code}
        </Text>
        <View style={styles.name}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.text }]} numberOfLines={2}>
            {name}
          </Text>
          {place !== airport.code ? (
            <Text
              lineBreakStrategyIOS="push-out"
              style={[textStyles.small, { color: c.muted }]}
              numberOfLines={1}
              testID="airport-place">
              {place}
            </Text>
          ) : null}
        </View>
        {tag ? (
          // Amber = "you" (DECISIONS.md): your homes and where you are.
          <View style={[styles.tag, { backgroundColor: c.youBg }]}>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.tagText, { color: c.youText }]}>
              {tag}
            </Text>
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
        <SheetHeader title={title} action="Cancel" onAction={close} centered />
        <View style={[searchCard, styles.input]}>
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
              <Text style={[textStyles.small, styles.sectionTitle, { color: c.muted }]} accessibilityRole="header">
                {section.title.toUpperCase()}
              </Text>
            ) : null
          }
          // A typed query with no match still has one (empty) section, so this is a footer.
          ListFooterComponent={
            empty ? (
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.empty, { color: c.muted }]}>
                No airports match “{query.trim()}”.
              </Text>
            ) : undefined
          }
        />
        <AirportSummarySheet code={info} onClose={() => setInfo(null)} />
      </SafeAreaView>
    </Modal>
  );
}

/** Room for a three-letter code in the mono face. */
const CODE_WIDTH = 44;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  input: {
    minHeight: minTapTarget,
    borderRadius: radius.all,
    paddingHorizontal: spacing.rowX,
    marginBottom: spacing.group,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
  },
  field: { flex: 1, minHeight: minTapTarget },
  sectionTitle: { letterSpacing: 0.6, paddingTop: spacing.page, paddingBottom: spacing.group, paddingHorizontal: spacing.rowX },
  item: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.section,
    paddingVertical: spacing.rowY,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.all,
  },
  // Starts at the airport's name, past the code.
  sep: {
    position: 'absolute',
    top: 0,
    left: spacing.rowX + CODE_WIDTH + spacing.section,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  code: { width: CODE_WIDTH, fontFamily: fonts.mono, fontSize: 15, lineHeight: 20, letterSpacing: 0.4 },
  name: { flex: 1, gap: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagText: { fontFamily: fonts.bodySemiBold },
  empty: { paddingVertical: spacing.page, textAlign: 'center' },
});
