import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AIRPORTS, areaFor } from '@/engine';
import { QUICK_DATE_CHIPS, type DateChip } from '@/search/dates';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { DatePickerModal } from './DatePickerModal';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { withTick } from './haptics';

export interface SearchPanelProps {
  chips: readonly DateChip[];
  date: string;
  onDate: (date: string) => void;
  origin: string | null;
  destination: string | null;
  onPickOrigin: () => void;
  /** What the empty From card says ("Finding nearest airport…" after Allow); default "Choose airport". */
  originEmptyText?: string;
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
  /** Where Get Home goes: the home's area city ("Dallas") or its code ("BNA"). */
  homeName?: string;
  /** Shown when no main home is set yet. */
  onSetHome?: () => void;
  /** First-launch location card (Q-051), shown above the dates when given. */
  locationCard?: ReactNode;
  /** Empty-results notice (Q-047), shown at the top so it's in view at half height. */
  banner?: ReactNode;
  /** "At DAL? Report a load" (round 33), under the search buttons: searching stays the main job. */
  airportCard?: ReactNode;
}

interface AirportCardProps {
  label: string;
  code: string | null;
  /** Second line while empty; defaults to "Choose airport". */
  emptyText?: string;
  onPress: () => void;
  areaOn: boolean;
  onToggleArea: () => void;
}

/** "DAL and DFW", "LAX, BUR, LGB, SNA and ONT". */
const listText = (codes: readonly string[]) =>
  codes.length < 2 ? codes.join('') : `${codes.slice(0, -1).join(', ')} and ${codes[codes.length - 1]}`;

/**
 * From/To card. When the airport belongs to an area (Q-048, Q-056) a pill at
 * the top-right toggles it: an outline gray "+ Area" when off, a solid
 * accent-blue "✓ All {City}" when on. On, the card lists every area airport.
 * The pill sits beside (not inside) the card's button so VoiceOver reaches
 * both, and comes first so it reads in visual order (top-right before code).
 */
export function AirportCard({ label, code, emptyText = 'Choose airport', onPress, areaOn, onToggleArea }: AirportCardProps) {
  const c = useColors();
  const name = code ? AIRPORTS[code]?.name : undefined;
  const area = code ? areaFor(code) : null;
  const whole = area != null && areaOn;
  const ink = areaOn ? c.onAccent : c.muted;
  return (
    <View style={[styles.card, { backgroundColor: c.surface2 }]}>
      {area ? (
        // Keeps the pill (and its slop) clear of the From/To label on the left.
        <View style={styles.pillSlot} pointerEvents="box-none">
          <Pressable
            onPress={withTick(onToggleArea)}
            accessibilityRole="switch"
            accessibilityState={{ checked: areaOn }}
            accessibilityLabel={`Area: include all ${area.city} airports`}
            accessibilityHint={`Searches ${listText(area.airports)}`}
            hitSlop={PILL_HIT_SLOP}
            style={pressStyle([styles.areaPill, { borderColor: areaOn ? c.accent : c.line2 }, areaOn ? { backgroundColor: c.accent } : null])}>
            <Icon
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
              maxFontSizeMultiplier={LABEL_MAX_SCALE}
              style={[textStyles.small, styles.pillText, { color: ink }]}>
              {areaOn ? `All ${area.city}` : 'Area'}
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
            : emptyText === 'Choose airport'
              ? `${label}: choose an airport`
              : `${label}: ${emptyText} Choose an airport`
        }
        style={pressStyle(styles.cardButton, 'link')}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.cardLabel, { color: c.muted }]} maxFontSizeMultiplier={LABEL_MAX_SCALE}>
          {label}
        </Text>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.title, { color: code ? c.text : c.faint }]}>{code ?? '—'}</Text>
        {whole ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.text }]}>{area.airports.join(' · ')}</Text>
        ) : null}
        {/* Two lines so long names ("Dallas/Fort Worth International") show at big text sizes. */}
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} numberOfLines={2}>
          {name ?? emptyText}
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
/**
 * The From/To label and the area pill share the card's top row, so they stop
 * growing at 1.3x; the airport code, name and area list below keep growing.
 */
const LABEL_MAX_SCALE = 1.3;
/** From this text size the four date chips go two to a row instead of shrinking. */
export const WRAP_CHIPS_SCALE = 1.2;

export function SearchPanel(p: SearchPanelProps) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  const wrapChips = fontScale >= WRAP_CHIPS_SCALE;
  // Why Find Routes is off, for VoiceOver and (same airport) on screen.
  const sameAirport = !!p.origin && p.origin === p.destination;
  const canSwap = !!p.origin && !!p.destination;
  const findBlocked = !p.origin
    ? 'Choose where you’re flying from first'
    : !p.destination
      ? 'Choose where you’re going first'
      : sameAirport
        ? 'From and To are the same airport'
        : undefined;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const quick = p.chips.slice(0, QUICK_DATE_CHIPS);
  // A day past the chips shows on the calendar button itself.
  const later = p.chips.slice(QUICK_DATE_CHIPS).find((chip) => chip.date === p.date);
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {p.locationCard}
      {/* At the top, not under Find Routes: away from home the Get Home row pushed it out of view. */}
      {p.banner}
      {/* One row, no sideways scroll: date chips share the width, calendar stays 44pt until it holds a date.
          At large text sizes they go two to a row so "Tomorrow" never gets cut off. */}
      <View style={[styles.chips, wrapChips && styles.chipsWrap]} testID="date-chips">
        {quick.map((chip) => {
          const on = chip.date === p.date;
          return (
            <Pressable
              key={chip.date}
              onPress={withTick(() => p.onDate(chip.date))}
              accessibilityRole="button"
              accessibilityLabel={chip.long}
              accessibilityState={{ selected: on }}
              style={pressStyle([
                styles.chip,
                styles.dateChip,
                wrapChips && styles.dateChipWrap,
                { backgroundColor: on ? c.accent : c.surface2 },
              ])}>
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
          style={pressStyle([
            styles.chip,
            styles.calendar,
            later ? styles.dateChip : null,
            wrapChips && styles.dateChipWrap,
            { backgroundColor: later ? c.accent : c.surface2 },
          ])}>
          <Icon
            name="calendar"
            size={18}
            tintColor={later ? c.onAccent : c.text}
            fallback={later ? null : <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.text }]}>Date</Text>}
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
          emptyText={p.originEmptyText}
          onPress={p.onPickOrigin}
          areaOn={!!(p.origin && p.areaOn[p.origin])}
          onToggleArea={() => p.origin && p.onToggleArea(p.origin)}
        />
        <Pressable
          onPress={withTick(p.onSwap)}
          // Off with one side empty: swapping would only clear the other.
          disabled={!canSwap}
          accessibilityRole="button"
          accessibilityLabel="Swap from and to"
          accessibilityHint={canSwap ? undefined : 'Choose both airports first'}
          accessibilityState={{ disabled: !canSwap }}
          style={pressStyle([styles.swap, { backgroundColor: c.surface, borderColor: c.line, opacity: canSwap ? 1 : 0.5 }])}>
          <Icon
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

      {/* Away from home, Get Home is the main button (Q-063, John 2026-10-30). */}
      {p.onGetHome ? (
        <Button
          label={p.homeName ? `Get Home · ${p.homeName}` : 'Get Home'}
          icon="house.fill"
          onPress={p.onGetHome}
          accessibilityLabel={`Get Home: find routes to your main home${p.homeName ? `, ${p.homeName}` : ''}`}
        />
      ) : null}
      {sameAirport ? (
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>From and To are the same airport. Change one to find routes.</Text>
      ) : null}
      {/* The main action sits right under From/To so it's in view at half height. */}
      <View style={styles.actions}>
        <Button
          label={p.filtersChanged ? `Filters (${p.filtersChanged})` : 'Filters'}
          icon="line.3.horizontal.decrease.circle"
          kind="secondary"
          onPress={p.onFilters}
        />
        <Button
          label="Find Routes"
          kind={p.onGetHome ? 'secondary' : 'primary'}
          onPress={p.onFind}
          disabled={!p.origin || !p.destination || p.origin === p.destination}
          accessibilityHint={findBlocked}
          style={styles.find}
        />
      </View>
      {p.onSetHome ? (
        <Pressable
          onPress={p.onSetHome}
          accessibilityRole="button"
          accessibilityLabel="Set your main home to use Get Home"
          accessibilityHint="Opens Settings at Homes"
          style={pressStyle([styles.hint, styles.homeHint, { backgroundColor: c.accentSoft }], 'link')}>
          <Icon
            name="house"
            size={15}
            tintColor={c.accent}
            fallback={<Text style={[textStyles.small, { color: c.accent }]}>⌂</Text>}
          />
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, styles.homeHintText, { color: c.accent }]}>Set your main home to use Get Home ›</Text>
        </Pressable>
      ) : null}
      {p.airportCard}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.page, paddingBottom: spacing.page, gap: spacing.section },
  chips: { flexDirection: 'row', gap: spacing.group },
  chip: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  dateChip: { flex: 1, paddingHorizontal: 6, alignItems: 'center' },
  chipsWrap: { flexWrap: 'wrap' },
  // Two per row; the calendar button takes the last row on its own.
  dateChipWrap: { flexGrow: 1, flexBasis: '40%' },
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
    minHeight: PILL_HEIGHT,
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
  homeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    paddingHorizontal: spacing.rowX,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  homeHintText: { flexShrink: 1 },
});
