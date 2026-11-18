import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { placeLabel, type Airport, type PlaceRef } from '@/engine';
import { matchAirports, pickerSections, SEARCH_AIRPORTS } from '@/search/airports';
import {
  findPlace,
  inPlace,
  matchPlaces,
  placeCodes,
  placeRef,
  placeTree,
  type PlaceKind,
  type PlaceNode,
} from '@/search/places';
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
  /**
   * A whole country, state or city picked (round 224). Without it the picker offers airports only.
   */
  onPickGroup?: (group: PlaceRef) => void;
  /** The place picked now, checked on its "All of" row. */
  currentGroup?: string | null;
}

/** One row of the list: an airport, a place to open, a place's "All of" pick, or the way back up. */
type Row =
  | { kind: 'airport'; airport: Airport; tag?: string }
  | { kind: 'place'; place: PlaceNode }
  | { kind: 'all'; place: PlaceNode }
  | { kind: 'back'; to: string | null; label: string };

interface Section {
  title: string | null;
  data: Row[];
}

const KIND_ICON: Record<PlaceKind, 'globe' | 'map' | 'building.2'> = { country: 'globe', region: 'map', city: 'building.2' };

export function AirportPicker({
  visible,
  title,
  onPick,
  onClose,
  current,
  nearest,
  homes,
  exclude,
  onPickGroup,
  currentGroup,
}: AirportPickerProps) {
  const c = useColors();
  const searchCard = useCardSurface({ lift: false });
  const [query, setQuery] = useState('');
  // Hold a row for its airport summary (round 174); the sheet lives inside this modal so it can open over it.
  const [info, setInfo] = useState<string | null>(null);
  const recent = useRecentAirports();
  // Countries, states and cities (round 224), from the airports this end can use.
  const offered = useMemo(
    () => (exclude?.length ? SEARCH_AIRPORTS.filter((a) => !exclude.includes(a.code)) : SEARCH_AIRPORTS),
    [exclude],
  );
  const tree = useMemo(() => (onPickGroup ? placeTree(offered) : []), [onPickGroup, offered]);
  // Which place is open; null is the top. Opens where the picked place sits, so its check shows.
  const [at, setAt] = useState<string | null>(null);
  useEffect(() => {
    if (visible) setAt(findPlace(tree, currentGroup)?.parent ?? null);
    // Only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const open = findPlace(tree, at);

  const sections = useMemo<Section[]>(() => {
    const airportRows = (items: { airport: Airport; tag?: string }[]): Row[] =>
      items.map((i) => ({ kind: 'airport', airport: i.airport, ...(i.tag ? { tag: i.tag } : {}) }));
    const typed = query.trim();
    if (typed) {
      // Places first ("Spain"), then the airports, those in a matching place included.
      const places = matchPlaces(tree, typed);
      const inPlaces = new Set(places.flatMap((p) => p.airports));
      const matched = matchAirports(typed, offered);
      const more = offered.filter((a) => inPlaces.has(a.code) && !matched.includes(a));
      return [
        {
          title: null,
          data: [
            ...places.map((place): Row => ({ kind: 'place', place })),
            ...airportRows([...matched, ...more].map((airport) => ({ airport }))),
          ],
        },
      ];
    }
    if (open) {
      const up = findPlace(tree, open.parent);
      return [
        { title: null, data: [{ kind: 'back', to: open.parent, label: up?.name ?? 'All airports' }] },
        {
          title: open.name,
          data: [
            { kind: 'all', place: open },
            ...open.children.map(
              (ch): Row => ('place' in ch ? { kind: 'place', place: ch.place } : { kind: 'airport', airport: ch.airport }),
            ),
          ],
        },
      ];
    }
    const plain = pickerSections('', { nearest, homes, recent, exclude });
    // With places on, "All airports" lists countries to open (round 224).
    return plain.map((sec) =>
      sec.title === 'All airports' && tree.length
        ? { title: sec.title, data: tree.map((place): Row => ({ kind: 'place', place })) }
        : { title: sec.title, data: airportRows(sec.data) },
    );
  }, [query, tree, offered, open, nearest, homes, recent, exclude]);
  const empty = sections.every((s) => s.data.length === 0);
  // Same tick as every other pick (design round 10).
  const pick = (code: string) => {
    selectionTick();
    setQuery('');
    setAt(null);
    rememberAirport(code);
    onPick(code);
  };
  const pickGroup = (place: PlaceNode) => {
    selectionTick();
    setQuery('');
    setAt(null);
    onPickGroup?.(placeRef(place));
  };
  const go = (key: string | null) => {
    selectionTick();
    setQuery('');
    setAt(key);
  };
  // Return picks the top airport match once something is typed (design round 29).
  const topMatch = query.trim()
    ? sections.flatMap((s) => s.data).find((r): r is Extract<Row, { kind: 'airport' }> => r.kind === 'airport')?.airport.code
    : undefined;

  const close = () => {
    setQuery('');
    setAt(null);
    onClose();
  };

  // "‹ United States": the way back up a level, in blue like every other thing you press.
  const renderBack = (item: Extract<Row, { kind: 'back' }>) => (
    <Pressable
      onPress={() => go(item.to)}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${item.label}`}
      testID="place-back"
      hitSlop={4}
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
      <Icon
        name="chevron.left"
        size={15}
        weight="semibold"
        tintColor={c.accent}
        fallback={<Text style={[textStyles.bodyStrong, { color: c.accent }]}>‹</Text>}
      />
      <Text style={[textStyles.bodyStrong, { color: c.accent }]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );

  // A country, state or city: opens to what's inside. "All of Texas" picks the whole place instead (round 224).
  // A place with one airport in it is that airport, so its row picks it straight away.
  const renderPlace = (item: Extract<Row, { kind: 'place' | 'all' }>, index: number) => {
    const { place } = item;
    const all = item.kind === 'all';
    const single = !all && place.airports.length === 1;
    const lone = single ? offered.find((a) => a.code === place.airports[0]) : undefined;
    const on = all && place.key === currentGroup;
    const titleText = all ? `All of ${inPlace(place.name)}` : place.name;
    const sub = lone ? (lone.airportName ?? lone.name) : placeCodes(place.airports, all ? 6 : 4);
    const press = all ? () => pickGroup(place) : lone ? () => pick(lone.code) : () => go(place.key);
    return (
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityState={all ? { selected: on } : undefined}
        accessibilityLabel={`${titleText}, ${sub}`}
        accessibilityHint={all || lone ? undefined : 'Shows what is in it'}
        testID={all ? 'place-all' : 'place-row'}
        style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.surface2 }]}>
        {index === 0 ? null : <View style={[styles.sep, { backgroundColor: c.line }]} />}
        <View style={styles.codeSlot}>
          {lone ? (
            <Text style={[styles.code, { color: c.accent }]} maxFontSizeMultiplier={1.4} testID="airport-code">
              {lone.code}
            </Text>
          ) : all ? (
            <Text style={[styles.code, { color: c.accent }]} maxFontSizeMultiplier={1.4}>
              ALL
            </Text>
          ) : (
            <Icon name={KIND_ICON[place.kind]} size={18} tintColor={c.accent} fallback={null} />
          )}
        </View>
        <View style={styles.name}>
          <Text style={[textStyles.bodyStrong, { color: c.text }]} numberOfLines={1}>
            {titleText}
          </Text>
          <Text style={[textStyles.small, { color: c.muted }]} numberOfLines={1} testID="place-codes">
            {sub}
          </Text>
        </View>
        {on ? (
          <Icon
            name="checkmark"
            size={16}
            weight="semibold"
            tintColor={c.accent}
            fallback={<Text style={[textStyles.bodyStrong, { color: c.accent }]}>✓</Text>}
          />
        ) : all || lone ? null : (
          <Icon name="chevron.right" size={14} tintColor={c.faint} fallback={null} />
        )}
      </Pressable>
    );
  };

  // Plain rows on the sheet, no card or outline around them (round 214, John: "Fix all of them"), with
  // hairlines between that start at the airport's name.
  const renderItem = ({ item, index }: { item: Row; index: number }) => {
    if (item.kind === 'back') return renderBack(item);
    if (item.kind !== 'airport') return renderPlace(item, index);
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
            placeholder={onPickGroup ? 'Airport, city, state or country' : 'Airport code or city'}
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
          keyExtractor={(item, i) =>
            item.kind === 'airport'
              ? `${item.tag ? 'quick' : 'all'}-${item.airport.code}-${i}`
              : item.kind === 'back'
                ? `back-${item.to}`
                : `${item.kind}-${item.place.key}`
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          // A level of places is short; draw it all at once so a state far down is there to tap.
          initialNumToRender={32}
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
                No {onPickGroup ? 'airports or places' : 'airports'} match “{query.trim()}”.
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
  codeSlot: { width: CODE_WIDTH, alignItems: 'flex-start', justifyContent: 'center' },
  back: {
    minHeight: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.rowX - 4,
    alignSelf: 'flex-start',
  },
  code: { width: CODE_WIDTH, fontFamily: fonts.mono, fontSize: 15, lineHeight: 20, letterSpacing: 0.4 },
  name: { flex: 1, gap: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagText: { fontFamily: fonts.bodySemiBold },
  empty: { paddingVertical: spacing.page, textAlign: 'center' },
});
