import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { AIRPORTS, areaFor } from '@/engine';
import { QUICK_DATE_CHIPS, type DateChip } from '@/search/dates';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { DatePickerModal } from './DatePickerModal';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { withTick } from './haptics';
import { useReducedMotion } from './useReducedMotion';

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
  /** How tall the panel is down to the bottom of Find Routes, so the drawer can open that far. */
  onFitHeight?: (height: number) => void;
}

interface AirportCardProps {
  label: string;
  code: string | null;
  /** Second line while empty; defaults to "Choose airport". */
  emptyText?: string;
  onPress: () => void;
  areaOn: boolean;
  onToggleArea: () => void;
  /** Bumped on each swap: the code slides in from the other card's side (John, 2026-11-01). */
  swapCount?: number;
  /** Which side the new code comes from: 1 = from the right (From), -1 = from the left (To). */
  slideFrom?: 1 | -1;
}

/** Swap motion (John, 2026-11-01): the button turns half a turn while the codes slide past each other. */
export const SWAP_MS = 280;
/** How far a code travels as it slides into its new card. */
export const SWAP_SLIDE = 28;

/**
 * Slides a card's code in from `from` (in points) each time `count` changes after the first
 * render. Reduce Motion: no slide.
 */
function useSwapSlide(count: number, from: number, reduce: boolean) {
  const x = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const first = useRef(count);
  useEffect(() => {
    if (count === first.current || reduce) return;
    x.setValue(from);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(x, { toValue: 0, duration: SWAP_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: SWAP_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [count, from, reduce, x, fade]);
  return { opacity: fade, transform: [{ translateX: x }] };
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
export function AirportCard({
  label,
  code,
  emptyText = 'Choose airport',
  onPress,
  areaOn,
  onToggleArea,
  swapCount = 0,
  slideFrom = 1,
}: AirportCardProps) {
  const reduce = useReducedMotion();
  const slide = useSwapSlide(swapCount, slideFrom * SWAP_SLIDE, reduce);
  // "Location is off. Choose airport" -> gray status, blue ask.
  const ask = /(Choose airport)$/.exec(emptyText);
  const action = !code && ask ? { status: emptyText.slice(0, ask.index).trim(), ask: ask[1] } : null;
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
            style={pressStyle([
              styles.areaPill,
              { borderColor: areaOn ? c.accent : c.line2 },
              areaOn ? { backgroundColor: c.accent } : null,
            ])}>
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
              : /choose/i.test(emptyText)
                ? `${label}: ${emptyText}`
                : `${label}: ${emptyText} Choose an airport`
        }
        style={pressStyle(styles.cardButton, 'link')}>
        <Text
          lineBreakStrategyIOS="push-out"
          style={[textStyles.small, styles.cardLabel, { color: c.muted }]}
          maxFontSizeMultiplier={LABEL_MAX_SCALE}>
          {label}
        </Text>
        <Animated.View style={slide} testID="card-code">
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.title, { color: code ? c.text : c.faint }]}>
            {code ?? '—'}
          </Text>
        </Animated.View>
        {whole ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.text }]}>
            {area.airports.join(' · ')}
          </Text>
        ) : null}
        {/* Two lines so long names ("Dallas/Fort Worth International") show at big text sizes. */}
        {/* An empty side says what to do in blue, so a dimmed Find Routes never needs explaining (round 53);
            a status before it ("Location is off.") stays gray. */}
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} numberOfLines={2}>
          {name ??
            (action ? (
              <>
                {action.status ? `${action.status} ` : null}
                <Text style={{ color: c.accent, fontFamily: textStyles.bodyStrong.fontFamily }}>{action.ask}</Text>
              </>
            ) : (
              emptyText
            ))}
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
  // One side filled is enough: swapping moves it across (John, 2026-11-01).
  const canSwap = !!p.origin || !!p.destination;
  const findBlocked = !p.origin
    ? 'Choose where you’re flying from first'
    : !p.destination
      ? 'Choose where you’re going first'
      : sameAirport
        ? 'From and To are the same airport'
        : undefined;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const reduce = useReducedMotion();
  // Each swap turns the button another half turn and slides the codes across.
  const [swaps, setSwaps] = useState(0);
  const turn = useRef(new Animated.Value(0)).current;
  const swap = () => {
    const next = swaps + 1;
    setSwaps(next);
    if (reduce) turn.setValue(next);
    else
      Animated.timing(turn, {
        toValue: next,
        duration: SWAP_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    p.onSwap();
  };
  const spin = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'], extrapolate: 'extend' });
  const quick = p.chips.slice(0, QUICK_DATE_CHIPS);
  // A day past the chips shows on the calendar button itself.
  const later = p.chips.slice(QUICK_DATE_CHIPS).find((chip) => chip.date === p.date);
  // Sliding date highlight (John, 2026-11-01): measured chip boxes, one row only.
  const [boxes, setBoxes] = useState<Record<string, ChipBox>>({});
  const live = [...quick.map((chip) => chip.date), CALENDAR_KEY];
  const selectedKey = later ? CALENDAR_KEY : p.date;
  const slider = !wrapChips && live.every((k) => boxes[k]) && !!boxes[selectedKey];
  const measure = (key: string) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setBoxes((prev) => {
      const was = prev[key];
      if (was && was.x === x && was.y === y && was.width === width && was.height === height) return prev;
      return { ...prev, [key]: { x, y, width, height } };
    });
  };
  const { hx, hw, litAt } = useChipHighlight(slider ? boxes[selectedKey] : undefined, boxes, reduce);
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {p.locationCard}
      {/* At the top, not under Find Routes: away from home the Get Home row pushed it out of view. */}
      {p.banner}
      {/* One row, no sideways scroll: date chips share the width, calendar stays 44pt until it holds a date.
          At large text sizes they go two to a row so "Tomorrow" never gets cut off. */}
      <View style={[styles.chips, wrapChips && styles.chipsWrap]} testID="date-chips">
        {/* One row: plain chip backs, then the highlight that slides between them, then the chips
            themselves on top (John, 2026-11-01). Two rows at big text: each chip draws its own. */}
        {slider
          ? Object.entries(boxes).map(([key, b]) => (
              <View
                key={`back-${key}`}
                pointerEvents="none"
                style={[styles.chipBack, { left: b.x, top: b.y, width: b.width, height: b.height, backgroundColor: c.surface2 }]}
              />
            ))
          : null}
        {slider ? (
          <Animated.View
            pointerEvents="none"
            testID="date-highlight"
            style={[
              styles.chipBack,
              {
                top: boxes[selectedKey]?.y ?? 0,
                height: boxes[selectedKey]?.height ?? 0,
                left: hx,
                width: hw,
                backgroundColor: c.accent,
              },
            ]}
          />
        ) : null}
        {quick.map((chip) => {
          const on = chip.date === p.date;
          return (
            <Pressable
              key={chip.date}
              onPress={withTick(() => p.onDate(chip.date))}
              onLayout={measure(chip.date)}
              accessibilityRole="button"
              accessibilityLabel={chip.long}
              accessibilityState={{ selected: on }}
              style={pressStyle([
                styles.chip,
                styles.dateChip,
                wrapChips && styles.dateChipWrap,
                { backgroundColor: slider ? 'transparent' : on ? c.accent : c.surface2 },
              ])}>
              <ChipDate chip={chip} on={on} lit={slider ? litAt(chip.date) : undefined} />
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCalendarOpen(true)}
          onLayout={measure(CALENDAR_KEY)}
          accessibilityRole="button"
          accessibilityLabel={later ? `${later.long}. Change date` : 'Pick a later date'}
          accessibilityState={{ selected: !!later }}
          style={pressStyle([
            styles.chip,
            styles.calendar,
            later ? styles.dateChip : null,
            wrapChips && styles.dateChipWrap,
            { backgroundColor: slider ? 'transparent' : later ? c.accent : c.surface2 },
          ])}>
          {/* A later day reads like any other chip; the calendar icon alone means "pick a day". */}
          {later ? (
            <ChipDate chip={later} on lit={slider ? litAt(CALENDAR_KEY) : undefined} />
          ) : (
            <Icon
              name="calendar"
              size={18}
              tintColor={c.text}
              fallback={
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.text }]}>
                  Date
                </Text>
              }
            />
          )}
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
          swapCount={swaps}
          slideFrom={1}
        />
        <Pressable
          onPress={withTick(swap)}
          // Off only with both sides empty; one filled side moves across.
          disabled={!canSwap}
          accessibilityRole="button"
          accessibilityLabel="Swap from and to"
          accessibilityHint={canSwap ? undefined : 'Choose an airport first'}
          accessibilityState={{ disabled: !canSwap }}
          style={pressStyle([styles.swap, { backgroundColor: c.surface, borderColor: c.line, opacity: canSwap ? 1 : 0.5 }])}>
          <Animated.View style={{ transform: [{ rotate: spin }] }} testID="swap-icon">
            <Icon
              name="arrow.left.arrow.right"
              size={18}
              tintColor={c.accent}
              fallback={<Text style={[textStyles.heading, { color: c.accent }]}>⇄</Text>}
            />
          </Animated.View>
        </Pressable>
        <AirportCard
          label="To"
          code={p.destination}
          onPress={p.onPickDestination}
          areaOn={!!(p.destination && p.areaOn[p.destination])}
          onToggleArea={() => p.destination && p.onToggleArea(p.destination)}
          swapCount={swaps}
          slideFrom={-1}
        />
      </View>

      {/* Away from home, Get Home is the main button (Q-063, John 2026-10-30). The screen leaves it out
          once To is already home, so there's one main button (John, 2026-11-01). */}
      {p.onGetHome ? (
        <Button
          label={p.homeName ? `Get Home · ${p.homeName}` : 'Get Home'}
          icon="house.fill"
          onPress={p.onGetHome}
          accessibilityLabel={`Get Home: find routes to your main home${p.homeName ? `, ${p.homeName}` : ''}`}
        />
      ) : null}
      {sameAirport ? (
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          From and To are the same airport. Change one to find routes.
        </Text>
      ) : null}
      {/* The main action sits right under From/To so it's in view at half height; the drawer opens
          down to here, so Filters and Find Routes are never under the fold (John, 2026-11-01). */}
      <View
        style={styles.actions}
        testID="search-actions"
        onLayout={
          p.onFitHeight
            ? (e) => p.onFitHeight!(Math.ceil(e.nativeEvent.layout.y + e.nativeEvent.layout.height + spacing.page))
            : undefined
        }>
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
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, styles.homeHintText, { color: c.accent }]}>
            Set your main home to use Get Home ›
          </Text>
        </Pressable>
      ) : null}
      {p.airportCard}
    </ScrollView>
  );
}

/**
 * One look for every date chip (John, 2026-11-01: "Tue 2, Wed 3 ... font size is also not
 * consistent"): a small line on top (Today, Tomorrow or the weekday) over the date in bold
 * ("Nov 3"). Fixed sizes, never shrunk to fit, so every chip matches.
 */
function ChipDate({ chip, on, lit }: { chip: DateChip; on: boolean; lit?: Animated.AnimatedInterpolation<number> }) {
  const c = useColors();
  // Under the sliding highlight the words turn white as it passes over them.
  const top = lit ? lit.interpolate({ inputRange: [0, 1], outputRange: [c.muted, c.onAccent] }) : on ? c.onAccent : c.muted;
  const day = lit ? lit.interpolate({ inputRange: [0, 1], outputRange: [c.text, c.onAccent] }) : on ? c.onAccent : c.text;
  return (
    <View style={styles.chipDate} testID="chip-date">
      <Animated.Text numberOfLines={1} style={[textStyles.small, { color: top }]}>
        {chip.label}
      </Animated.Text>
      <Animated.Text numberOfLines={1} style={[textStyles.bodyStrong, { color: day }]}>
        {chip.day}
      </Animated.Text>
    </View>
  );
}

/** The calendar button's key among the measured chips. */
const CALENDAR_KEY = 'calendar';
/** How long the date highlight takes to slide to a new chip. */
export const HIGHLIGHT_MS = 240;

interface ChipBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The date highlight's left edge and width, sliding to the picked chip, and how lit each chip is
 * (1 under the highlight, 0 a chip away) so its words change color as it passes. JS-driven,
 * since text color can't run on the native driver; it's one small box. Reduce Motion: it jumps.
 */
function useChipHighlight(target: ChipBox | undefined, boxes: Record<string, ChipBox>, reduce: boolean) {
  const hx = useRef(new Animated.Value(0)).current;
  const hw = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const tx = target?.x;
  const tw = target?.width;
  useEffect(() => {
    if (tx == null || tw == null) return;
    if (!placed.current || reduce) {
      placed.current = true;
      hx.setValue(tx);
      hw.setValue(tw);
      return;
    }
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(hx, { toValue: tx, duration: HIGHLIGHT_MS, easing: ease, useNativeDriver: false }),
      Animated.timing(hw, { toValue: tw, duration: HIGHLIGHT_MS, easing: ease, useNativeDriver: false }),
    ]).start();
  }, [tx, tw, reduce, hx, hw]);
  const litAt = (key: string) => {
    const b = boxes[key];
    const span = Math.max(1, b?.width ?? 1);
    const x = b?.x ?? 0;
    return hx.interpolate({ inputRange: [x - span, x, x + span], outputRange: [0, 1, 0], extrapolate: 'clamp' });
  };
  return { hx, hw, litAt };
}

const styles = StyleSheet.create({
  chipDate: { alignItems: 'center' },
  chipBack: { position: 'absolute', borderRadius: radius.sm },
  body: { paddingHorizontal: spacing.page, paddingBottom: spacing.page, gap: spacing.section },
  chips: { flexDirection: 'row', gap: spacing.group },
  chip: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    paddingVertical: 6,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  // Narrow side padding so "Tomorrow" fits five across on a 375pt phone without shrinking.
  dateChip: { flex: 1, paddingHorizontal: 4, alignItems: 'center' },
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
