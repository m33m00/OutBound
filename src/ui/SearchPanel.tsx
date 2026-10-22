import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AIRPORTS, areaFor } from '@/engine';
import { QUICK_DATE_CHIPS, type DateChip } from '@/search/dates';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { DatePickerModal } from './DatePickerModal';
import { SampleLabel } from './ResultsPanel';

export interface SearchPanelProps {
  chips: readonly DateChip[];
  date: string;
  onDate: (date: string) => void;
  origin: string | null;
  destination: string | null;
  onPickOrigin: () => void;
  onPickDestination: () => void;
  onSwap: () => void;
  /** Area toggle per airport code (Q-048); missing = off. */
  areaOn: Readonly<Record<string, boolean>>;
  onToggleArea: (code: string) => void;
  onFilters: () => void;
  /** How many filters differ from the defaults. */
  filtersChanged: number;
  onFind: () => void;
  /** Shown when away from home: To = main home, then search (Q-026). */
  onGetHome?: () => void;
  /** Shown when no main home is set yet. */
  onSetHome?: () => void;
}

interface AirportCardProps {
  label: string;
  code: string | null;
  onPress: () => void;
  areaOn: boolean;
  onToggleArea: () => void;
}

/** "DAL and DFW", "LAX, BUR, LGB, SNA and ONT". */
const listText = (codes: readonly string[]) =>
  codes.length < 2 ? codes.join('') : `${codes.slice(0, -1).join(', ')} and ${codes[codes.length - 1]}`;

/**
 * From/To card. When the airport belongs to an area (Q-048) a pill at the
 * top-right toggles "All {City}": same pill and words in both states, only
 * the fill and mark (+ / check) change. On, the card lists every area airport.
 * The pill sits beside (not inside) the card's button so VoiceOver reaches
 * both, and comes first so it reads in visual order (top-right before code).
 */
export function AirportCard({ label, code, onPress, areaOn, onToggleArea }: AirportCardProps) {
  const c = useColors();
  const name = code ? AIRPORTS[code]?.name : undefined;
  const area = code ? areaFor(code) : null;
  const whole = area != null && areaOn;
  const ink = areaOn ? c.onAccent : c.accent;
  return (
    <View style={[styles.card, { backgroundColor: c.surface2 }]}>
      {area ? (
        // Keeps the pill (and its slop) clear of the From/To label on the left.
        <View style={styles.pillSlot} pointerEvents="box-none">
          <Pressable
            onPress={onToggleArea}
            accessibilityRole="switch"
            accessibilityState={{ checked: areaOn }}
            accessibilityLabel={`Include all ${area.city} airports`}
            accessibilityHint={`Searches ${listText(area.airports)}`}
            hitSlop={PILL_HIT_SLOP}
            style={[styles.areaPill, { borderColor: c.accent }, areaOn ? { backgroundColor: c.accent } : null]}>
            <SymbolView
              name={areaOn ? 'checkmark' : 'plus'}
              size={11}
              weight="bold"
              tintColor={ink}
              fallback={<Text style={[textStyles.small, { color: ink }]}>{areaOn ? '✓' : '+'}</Text>}
            />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[textStyles.small, styles.pillText, { color: ink }]}>
              All {area.city}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          code
            ? `${label}: ${code}, ${name}${whole ? `, all ${area.city} airports` : ''}. Change`
            : `${label}: choose an airport`
        }
        style={styles.cardButton}>
        <Text style={[textStyles.small, styles.cardLabel, { color: c.muted }]}>{label}</Text>
        <Text style={[textStyles.title, { color: code ? c.text : c.faint }]}>{code ?? '—'}</Text>
        {whole ? (
          <Text style={[textStyles.small, { color: c.text }]}>{area.airports.join(' · ')}</Text>
        ) : null}
        <Text style={[textStyles.small, { color: c.muted }]} numberOfLines={1}>
          {name ?? 'Choose airport'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Area pill: 28pt tall at 8pt from the top; 8pt slop above and below makes
 * a 44pt target that ends where the big code starts (card label row is 44pt).
 */
const PILL_TOP = 8;
const PILL_HEIGHT = 28;
const PILL_SLOP = (minTapTarget - PILL_HEIGHT) / 2;
const PILL_HIT_SLOP = { top: PILL_SLOP, bottom: PILL_SLOP, left: 8, right: 8 };
/** Space kept for the "From"/"To" label left of the pill. */
const PILL_LEFT = 56;
/** Label centered on the pill; the code starts below the pill's tap target. */
const LABEL_TOP = PILL_TOP + (PILL_HEIGHT - textStyles.small.lineHeight) / 2;
const LABEL_GAP = minTapTarget - LABEL_TOP - textStyles.small.lineHeight;

export function SearchPanel(p: SearchPanelProps) {
  const c = useColors();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const quick = p.chips.slice(0, QUICK_DATE_CHIPS);
  // A day past the chips shows on the calendar button itself.
  const later = p.chips.slice(QUICK_DATE_CHIPS).find((chip) => chip.date === p.date);
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.sampleRow}>
        <SampleLabel />
      </View>
      {/* One row, no sideways scroll: date chips share the width, calendar stays 44pt until it holds a date. */}
      <View style={styles.chips}>
        {quick.map((chip) => {
          const on = chip.date === p.date;
          return (
            <Pressable
              key={chip.date}
              onPress={() => p.onDate(chip.date)}
              accessibilityRole="button"
              accessibilityLabel={chip.long}
              accessibilityState={{ selected: on }}
              style={[styles.chip, styles.dateChip, { backgroundColor: on ? c.accent : c.surface2 }]}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.text }]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCalendarOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={later ? `${later.long}. Change date` : 'Pick a later date'}
          accessibilityState={{ selected: !!later }}
          style={[
            styles.chip,
            styles.calendar,
            later ? styles.dateChip : null,
            { backgroundColor: later ? c.accent : c.surface2 },
          ]}>
          <SymbolView
            name="calendar"
            size={18}
            tintColor={later ? c.onAccent : c.text}
            fallback={later ? null : <Text style={[textStyles.bodyStrong, { color: c.text }]}>Date</Text>}
          />
          {later ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[textStyles.bodyStrong, { color: c.onAccent }]}>
              {later.label}
            </Text>
          ) : null}
        </Pressable>
      </View>
      <DatePickerModal
        visible={calendarOpen}
        date={p.date}
        min={p.chips[0].date}
        max={p.chips[p.chips.length - 1].date}
        onPick={p.onDate}
        onClose={() => setCalendarOpen(false)}
      />

      <View style={styles.cards}>
        <AirportCard
          label="From"
          code={p.origin}
          onPress={p.onPickOrigin}
          areaOn={!!(p.origin && p.areaOn[p.origin])}
          onToggleArea={() => p.origin && p.onToggleArea(p.origin)}
        />
        <Pressable
          onPress={p.onSwap}
          accessibilityRole="button"
          accessibilityLabel="Swap from and to"
          style={[styles.swap, { backgroundColor: c.surface, borderColor: c.line }]}>
          <SymbolView
            name="arrow.left.arrow.right"
            size={18}
            tintColor={c.accent}
            fallback={<Text style={[textStyles.heading, { color: c.accent }]}>⇄</Text>}
          />
        </Pressable>
        <AirportCard
          label="To"
          code={p.destination}
          onPress={p.onPickDestination}
          areaOn={!!(p.destination && p.areaOn[p.destination])}
          onToggleArea={() => p.destination && p.onToggleArea(p.destination)}
        />
      </View>

      {p.onGetHome ? (
        <Button label="Get Home" kind="secondary" onPress={p.onGetHome} accessibilityLabel="Get Home: search to your main home" />
      ) : null}
      {p.onSetHome ? (
        <Pressable onPress={p.onSetHome} accessibilityRole="button" style={styles.hint}>
          <Text style={[textStyles.small, { color: c.accent }]}>Set your home airport in Profile ›</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={p.filtersChanged ? `Filters (${p.filtersChanged})` : 'Filters'}
          icon="line.3.horizontal.decrease.circle"
          kind="secondary"
          onPress={p.onFilters}
        />
        <Button
          label="Find Routes"
          onPress={p.onFind}
          disabled={!p.origin || !p.destination || p.origin === p.destination}
          style={styles.find}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.page, paddingBottom: spacing.page, gap: spacing.section },
  sampleRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  chips: { flexDirection: 'row', gap: spacing.group },
  chip: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  dateChip: { flex: 1, paddingHorizontal: 6, alignItems: 'center' },
  calendar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: minTapTarget },
  cards: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  card: { flex: 1, alignSelf: 'stretch', borderRadius: radius.md },
  cardButton: { flex: 1, padding: spacing.rowX, paddingTop: LABEL_TOP, minHeight: minTapTarget },
  cardLabel: { marginBottom: LABEL_GAP },
  pillSlot: {
    position: 'absolute',
    top: PILL_TOP,
    left: PILL_LEFT,
    right: 8,
    alignItems: 'flex-end',
    zIndex: 1,
  },
  areaPill: {
    maxWidth: '100%',
    height: PILL_HEIGHT,
    paddingHorizontal: 10,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillText: { flexShrink: 1 },
  swap: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: minTapTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.group },
  find: { flex: 1 },
  hint: { minHeight: minTapTarget, justifyContent: 'center' },
});
