import { type ComponentRef, memo, type ReactNode, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, type TextStyle, useWindowDimensions, View } from 'react-native';

import { AIRPORTS, type Flight, type Itinerary, type LegSeats } from '@/engine';
import type { RouteImpact } from '@/live';
import {
  forSpeech,
  formatDuration,
  formatTime,
  neutralSeatText,
  routeSeatAge,
  SHOW_SEAT_AGE,
  routeSeatSummary,
  rowAccessibilityLabel,
  rowTimes,
  seatText,
  slimStops,
  stopCount,
} from '@/search/format';
import { statusHeadline } from '@/search/headline';
import { impactSummary } from '@/search/impactText';
import { liveLayoverMin, liveTotalMin, type LegStatusView, type RowStatus } from '@/search/statusTags';
import {
  elevation,
  fonts,
  InkContext,
  inkColors,
  radius,
  spacing,
  textStyles,
  useBoldText,
  useColors,
  useColorSchemeName,
} from '@/theme';

import { AirlinePill } from './AirlinePill';
import { Icon } from './Icon';
import { MetaLine } from './MetaLine';
import { MiniRoute } from './MiniRoute';
import { TearSourceProvider, type TearSource } from './TearAway';
import { TicketTear } from './TicketTear';
import { pressStyle } from './press';
import { ScalePressable } from './ScalePressable';
import { StatusTag, TAG_TONE } from './StatusTag';
import { withTick } from './haptics';
import { shiftMinutes, shiftToken } from './timeShift';
import { TIER_BG, TIER_FG } from './tierColors';

export interface ResultRowProps {
  itinerary: Itinerary;
  selected: boolean;
  now: number;
  onPress: (id: string) => void;
  /** Delay/weather impact (Q-001, item 7); undefined while not available. */
  impact?: RouteImpact;
  /** Live data still loading for the first time. */
  impactLoading?: boolean;
  onImpactPress?: (id: string) => void;
  /** Opens flight status for one leg (item 8). Text only; never feeds the row badge. */
  onLegPress?: (flight: Flight) => void;
  /** Live status tags per leg (Q-050); kept separate from the impact badge. */
  status?: RowStatus;
  /** Route view (John, 2026-10-30): leg lines in body-size text. */
  large?: boolean;
  /** In My Trips (Q-043): a small bookmark before the route line in the list. */
  saved?: boolean;
  /** Route card only: a control pinned top right, beside the headline (Save, John 2026-11-01). */
  topAction?: ReactNode;
}

/** From this text size the seat chip and delay badge sit left-aligned under the times. */
export const STACK_TOP_LINE_SCALE = 1.3;

/** "7:05 AM" never splits between the number and AM/PM, so a long time line only wraps at the dash. */
const keep = (time: string) => time.replace(/ /g, '\u00a0');

/** A leg's scheduled departure at its origin, e.g. "8:00 AM". */
const legDepartText = (leg: Flight) => formatTime(leg.departUtc, AIRPORTS[leg.from]?.tz ?? 'UTC');
const legArriveText = (leg: Flight) => formatTime(leg.arriveUtc, AIRPORTS[leg.to]?.tz ?? 'UTC');

/** Size of the dot that marks each leg on the route card's timeline: big enough to hold "60/19" (John, 2026-11-02). */
const DOT = 40;

/**
 * The seats inside a leg's dot (John, 2026-11-02): open/listed, "10/3"; the net count when only that's
 * known; "~20" for a typical load; a dash when there's no data.
 */
export function dotSeats(seats: LegSeats): string {
  if (seats.source === 'unknown' || seats.netSeats == null) return '–';
  if (seats.source === 'typical') return `~${Math.max(0, seats.netSeats)}`;
  if (seats.openSeats != null && seats.listed != null) return `${seats.openSeats}/${seats.listed}`;
  return `${Math.max(0, seats.netSeats)}`;
}
/** Under the route card's legs: how to read a seat circle (round 126, John). */
export const SEAT_CIRCLE_HINT = 'In each circle: open seats / people listed';

/** Space above and below a connection label, before any extra that centers it on the line. */
const CONNECTION_PAD = 6;

/**
 * A leg's times on the timeline: departure and arrival (John, 2026-11-02). A moved time shows the
 * new one, tinted by how far it moved; a canceled leg shows its schedule struck through, muted;
 * a diverted one shows "TBD" for its arrival, muted, until the new time is known.
 */
function LegTimes({ leg, view, text, dimmed }: { leg: Flight; view?: LegStatusView; text: TextStyle; dimmed: boolean }) {
  const c = useColors();
  const t = legTimesText(leg, view);
  const canceled = view?.tag?.kind === 'canceled';
  const tint = (min: number | null) => {
    const token = dimmed || canceled ? null : shiftToken(min);
    return dimmed || canceled ? c.muted : token ? c[token] : c.text;
  };
  const departColor = tint(view?.newUtc != null ? shiftMinutes(view.newUtc, view.scheduledUtc) : null);
  const arriveColor = tint(view?.arrival ? shiftMinutes(view.arrival.newUtc, leg.arriveUtc) : null);
  // Tabular figures so times line up row to row (round 113).
  const strong = { fontFamily: fonts.mono, fontVariant: ['tabular-nums' as const] };
  return (
    <Text style={[text, strong, canceled && styles.struck]} testID="leg-times">
      <Text style={{ color: departColor }} testID="leg-clock">
        {keep(t.depart)}
      </Text>
      <Text style={{ color: canceled || dimmed ? c.muted : c.text }}>{' – '}</Text>
      <Text style={{ color: t.pending ? c.muted : arriveColor }} testID="leg-arrive">
        {keep(t.arrive)}
      </Text>
    </Text>
  );
}

/**
 * The stop count on top of the trip length, right-aligned (round 124, John: "Can the number of stops
 * be listed on top of the time? Even when it says Nonstop?"). A short layover rides on the stops
 * line after a thin divider.
 */
function StopsStack({ stops, length, color, lead }: { stops: string; length: string | null; color: string; lead: string }) {
  return (
    <View style={styles.stopsStack} testID="row-stops">
      <MetaLine
        text={stops}
        gap={6}
        style={styles.stopsTop}
        textStyle={[textStyles.small, { color: lead, fontFamily: fonts.bodyMedium }]}
        testID="row-stop-count"
      />
      {length ? (
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color }]} testID="row-trip-length">
          {length}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * "3h 25m connection at DEN, change airlines to UA"; "Misses the connection at DEN" when the
 * onward flight leaves first. The switch names the onward airline (John, 2026-11-03).
 */
export function connectionText(c: { airport: string; sameAirline: boolean }, layoverMin: number, nextAirline?: string): string {
  const what =
    layoverMin < 0 ? `Misses the connection at ${c.airport}` : `${formatDuration(layoverMin)} connection at ${c.airport}`;
  if (c.sameAirline) return what;
  return `${what}, change airlines${nextAirline ? ` to ${nextAirline}` : ''}`;
}

/**
 * Width every leg's status tag is widened to, so the flight chips that follow line up: the widest
 * measured tag, once all `tagged` legs have reported. Undefined until then (tags show at their own size).
 */
export function tagColumnWidth(widths: Record<number, number>, tagged: number): number | undefined {
  const measured = Object.values(widths);
  if (tagged < 2 || measured.length < tagged) return undefined;
  return Math.ceil(Math.max(...measured));
}

function legSpokenTimes(leg: Flight, view?: LegStatusView): string {
  const t = legTimesText(leg, view);
  return t.pending ? `departs ${t.depart}, arrival time not known yet` : `departs ${t.depart}, arrives ${t.arrive}`;
}

/**
 * A leg's two times: the new ones when they moved, the schedule otherwise (canceled shows it struck).
 * A diverted leg keeps an arrival slot that reads "TBD" until a new time is known (John, 2026-11-02).
 */
export function legTimesText(leg: Flight, view?: LegStatusView): { depart: string; arrive: string; pending: boolean } {
  const depart = view?.newText ?? legDepartText(leg);
  if (view?.tag?.kind === 'diverted') return { depart, arrive: ARRIVAL_TBD, pending: true };
  return { depart, arrive: view?.arrival?.newText ?? legArriveText(leg), pending: false };
}

/** The trip's length with the live times; left off while a diverted leg's arrival is unknown. */
export function tripLength(it: Itinerary, status: RowStatus | undefined): string | null {
  return status?.arrivalPending && !status.canceled ? null : formatDuration(liveTotalMin(it, status));
}

/** The route's chip when a leg is canceled, in place of its chance word. */
export const NOT_FLYABLE = 'Unavailable';

/** A result row under the finger: a gentler shrink and dim than a button, so a big card doesn't jump. */
export const CARD_PRESS_SCALE = 0.985;
export const CARD_PRESSED_OPACITY = 0.92;

/** What a diverted leg's arrival slot reads. */
export const ARRIVAL_TBD = 'TBD';

/**
 * The route card's legs (design round 56; slimmed in round 66, John picked A on 2026-10-31).
 * Since round 80 (John, 2026-11-01) each flight is its own box, so it's plain that you tap it
 * to open the flight: no caret. A thin line runs down the left with a dot per flight, centered
 * on its box, in that flight's seat color. Inside each box (round 111): the times, the airports in one
 * column across boxes, then the flight chip with any status pill to its right; a nonstop's box skips
 * the times, which the header already shows. Between boxes, the
 * connection sits beside the line at its middle (round 75).
 */
function LegTimeline({
  itinerary: it,
  status,
  now,
  large,
  dimmed,
  onLegPress,
}: {
  itinerary: Itinerary;
  status?: RowStatus;
  now: number;
  large: boolean;
  dimmed: boolean;
  onLegPress?: (flight: Flight) => void;
}) {
  const c = useColors();
  const stacked = useWindowDimensions().fontScale >= STACK_TOP_LINE_SCALE;
  const text = large ? textStyles.body : textStyles.small;
  const rail = { backgroundColor: c.line2 };
  // Each box's measured height. Its dot sits at its middle, so the line between two dots runs
  // half of one box, the connection, and half of the next; the label is placed at its middle.
  const [legHeights, setLegHeights] = useState<Record<number, number>>({});
  // Each leg's status tag is widened to the widest one so the flight chips after them line up
  // (John, 2026-11-02). Widths are kept per set of labels, so a tag that gets shorter re-measures.
  // Flight chips first, in one column wide enough for the widest, so the status pills after them
  // line up top to bottom (John, 2026-11-02: "aligned looking top to bottom").
  const tagKey = it.legs.map((l) => `${l.flight.airline}${l.flight.flightNumber}`).join('|');
  const [tagWidths, setTagWidths] = useState<{ key: string; widths: Record<number, number> }>({ key: tagKey, widths: {} });
  const widths = tagWidths.key === tagKey ? tagWidths.widths : {};
  const anyTag = it.legs.some((_, i) => status?.legs[i]?.tag);
  const tagColumn = anyTag ? tagColumnWidth(widths, it.legs.length) : undefined;
  const measureTag = (i: number) => (e: { nativeEvent: { layout: { width: number } } }) => {
    const w = e.nativeEvent.layout.width;
    setTagWidths((prev) => {
      const base = prev.key === tagKey ? prev.widths : {};
      return base[i] === w && prev.key === tagKey ? prev : { key: tagKey, widths: { ...base, [i]: w } };
    });
  };
  // The same for each leg's times, so the airports after them start at one spot in every box
  // (John, 2026-11-02: "markets in both containers don't align top to bottom").
  const timesKey = it.legs.map((l, i) => Object.values(legTimesText(l.flight, status?.legs[i])).join('-')).join('|');
  const [timeWidths, setTimeWidths] = useState<{ key: string; widths: Record<number, number> }>({ key: timesKey, widths: {} });
  const timesColumn = stacked ? undefined : tagColumnWidth(timeWidths.key === timesKey ? timeWidths.widths : {}, it.legs.length);
  const measureTimes = (i: number) => (e: { nativeEvent: { layout: { width: number } } }) => {
    const w = e.nativeEvent.layout.width;
    setTimeWidths((prev) => {
      const base = prev.key === timesKey ? prev.widths : {};
      return base[i] === w && prev.key === timesKey ? prev : { key: timesKey, widths: { ...base, [i]: w } };
    });
  };
  const nonstop = it.legs.length === 1;
  const measure = (i: number) => (e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    setLegHeights((prev) => (prev[i] === h ? prev : { ...prev, [i]: h }));
  };
  return (
    <View testID="leg-timeline">
      {it.legs.map((leg, i) => {
        const view = status?.legs[i];
        const risk = status?.risks.find((r) => r.index === i);
        const connection = it.connections[i];
        // The connection with the times shown, so a delay moves it (John, 2026-11-02).
        const layover = connection ? liveLayoverMin(it, status, i) : NaN;
        const last = i === it.legs.length - 1;
        const typical = leg.seats.source === 'typical' || leg.seats.source === 'unknown';
        // The dot carries the leg's tier color; the route's chance word is in the headline.
        const dotTier = dimmed || typical || view?.tag?.kind === 'canceled' ? 'unknown' : leg.seats.tier;
        // Every box has one layout (John, 2026-11-02): times and airports first, then the flight
        // chip with its status pill after it.
        const pills = (
          <View style={styles.legMeta} testID="leg-flight">
            <View
              style={[styles.chipCol, tagColumn ? { minWidth: tagColumn } : null]}
              onLayout={tagColumn || !anyTag ? undefined : measureTag(i)}
              testID="leg-chip-col">
              <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
            </View>
            {view?.tag ? <StatusTag label={view.tag.label} tone={TAG_TONE[view.tag.kind]} /> : null}
          </View>
        );
        const content = (
          <>
            {/* Times, then the airports in one column across the boxes; the airports shrink a little
                to fit rather than wrap. */}
            <View style={[styles.legLineRow, stacked && styles.legLineWrap]} testID="leg-line">
              {/* A nonstop's times are the header's; the box says only where and which flight (John, 2026-11-02). */}
              {nonstop ? null : (
                <View
                  style={timesColumn ? { minWidth: timesColumn } : null}
                  onLayout={timesColumn || stacked ? undefined : measureTimes(i)}
                  testID="leg-times-col">
                  <LegTimes leg={leg.flight} view={view} text={text} dimmed={dimmed} />
                </View>
              )}
              <Text
                style={[styles.legCodes, styles.shrink, { color: dimmed ? c.muted : c.text }]}
                numberOfLines={stacked ? undefined : 1}
                adjustsFontSizeToFit={!stacked}
                minimumFontScale={0.8}
                testID="leg-airports">
                {`${leg.flight.from}\u00a0→\u00a0${leg.flight.to}`}
              </Text>
            </View>
            {/* A diversion goes on to the planned airport, late (John, 2026-11-01). */}
            {view?.tag?.kind === 'diverted' ? (
              <Text style={[textStyles.small, { color: c.muted }]} testID="leg-diverted-note">
                {`Continuing to ${leg.flight.to}`}
              </Text>
            ) : null}
            {pills}
          </>
        );
        const boxStyle = [styles.legBox, { backgroundColor: c.surface2 }];
        // Half the line runs through this box, half through the next; the label goes where they meet.
        const half = (h?: number) => Math.max(0, ((h ?? 0) - DOT) / 2);
        const tail = half(legHeights[i]);
        const head = half(legHeights[i + 1]);
        return (
          <View key={leg.flight.id}>
            <View style={styles.leg} onLayout={measure(i)}>
              <View style={styles.railCol}>
                <View style={[styles.railHalf, i > 0 && rail]} />
                <View style={[styles.dot, { backgroundColor: c[TIER_BG[dotTier]], borderColor: c[dotTier] }]} testID="leg-dot">
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    maxFontSizeMultiplier={1.2}
                    style={[styles.dotText, { color: c[TIER_FG[dotTier]] }]}
                    testID="leg-dot-seats">
                    {dotSeats(leg.seats)}
                  </Text>
                </View>
                <View style={[styles.railHalf, !last && rail]} />
              </View>
              {onLegPress ? (
                <ScalePressable
                  scaleTo={0.98}
                  pressedOpacity={0.85}
                  onPress={withTick(() => onLegPress(leg.flight))}
                  accessibilityRole="button"
                  // The label replaces what's inside, so it says the leg's time and seats too.
                  accessibilityLabel={[
                    `Flight status, ${leg.flight.airline} ${leg.flight.flightNumber}, ${leg.flight.from} to ${leg.flight.to}`,
                    // A canceled leg's tag already says "Canceled, was 10:40 AM".
                    view?.tag?.kind === 'canceled' ? null : legSpokenTimes(leg.flight, view),
                    view?.tag?.spoken,
                    forSpeech(seatText(leg.seats, now)),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  testID="leg-box"
                  style={boxStyle}>
                  {content}
                </ScalePressable>
              ) : (
                <View style={boxStyle} testID="leg-box">
                  {content}
                </View>
              )}
            </View>
            {/* At the connecting airport, i.e. after the inbound leg (Q-050), named as a
                connection (John, 2026-11-01). */}
            {last ? null : (
              <View style={styles.leg}>
                <View style={styles.railCol}>
                  <View style={[styles.railLine, rail]} />
                </View>
                <View
                  testID="leg-connection"
                  style={[
                    styles.connection,
                    {
                      paddingTop: CONNECTION_PAD + Math.max(0, head - tail),
                      paddingBottom: CONNECTION_PAD + Math.max(0, tail - head),
                    },
                  ]}>
                  {connection ? (
                    <Text
                      lineBreakStrategyIOS="push-out"
                      style={[textStyles.small, styles.shrink, { color: c.muted }]}
                      testID="leg-connection-text">
                      {connectionText(connection, layover, it.legs[i + 1]?.flight.airline)}
                    </Text>
                  ) : null}
                  {/* The tag marks a connection the live times squeeze or break. */}
                  {risk ? <StatusTag label={layover < 0 ? 'Missed' : 'At risk'} tone="delayed" /> : null}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export const ResultRow = memo(function ResultRow({
  itinerary: it,
  selected,
  now,
  onPress,
  impact,
  onImpactPress,
  onLegPress,
  status,
  large,
  saved,
  topAction,
}: ResultRowProps) {
  const c = useColors();
  const scheme = useColorSchemeName();
  // The route card's header tears off along its perforation when you save it (round 126, John); this
  // hides the real header while its copy flies into My Trips, then eases it back.
  const stubRef = useRef<ComponentRef<typeof View>>(null);
  const hold = useRef(new Animated.Value(1)).current;
  // A memo row redraws when Bold Text changes.
  useBoldText();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_TOP_LINE_SCALE;
  const rt = rowTimes(it);
  const t = { ...rt, depart: keep(rt.depart), arrive: keep(rt.arrive) };
  const hasImpact = impact != null && impact.level !== 'none';
  const label = forSpeech(
    [
      rowAccessibilityLabel(it, now),
      status?.canceled ? `${NOT_FLYABLE} as listed` : '',
      ...(status?.spoken ?? []),
      hasImpact ? impactSummary(impact, now) : '',
      saved && !large ? 'Saved to My Trips' : '',
    ]
      .filter(Boolean)
      .join('. '),
  );
  const actions = [
    ...(hasImpact ? [{ name: 'impact', label: 'Delay and weather details' }] : []),
    ...(onLegPress
      ? it.legs.map((l, i) => ({
          name: `leg-${i}`,
          label: `Flight status, ${l.flight.airline} ${l.flight.flightNumber}`,
        }))
      : []),
  ];
  // Seats lead the slim row's top line (Q-059); the delay badge sits after them.
  const summary = routeSeatSummary(it);
  const first = status?.legs[0];
  // Departed rows are dimmed with a gray fill and edge; text keeps 4.5:1.
  const dimmed = !!status?.dimmed;
  const notFlyable = !!status?.canceled;
  // The route card's header panel (round 114 onward): what's drawn on it takes the ink palette, which
  // in the Clean look is just the card itself.
  const hc = large ? inkColors[scheme] : c;
  const timeColor = dimmed ? hc.muted : hc.text;
  // A time that moved is tinted by how far: early green, then yellow, orange, red (John, 2026-11-02).
  const tint = (min: number | null) => {
    const token = dimmed ? null : shiftToken(min);
    return token ? { color: hc[token] } : null;
  };
  const departTint = first?.newUtc != null ? tint(shiftMinutes(first.newUtc, first.scheduledUtc)) : null;
  const lastLeg = it.legs[it.legs.length - 1]?.flight;
  const arriveTint = status?.arrival && lastLeg ? tint(shiftMinutes(status.arrival.newUtc, lastLeg.arriveUtc)) : null;
  const highlight = selected && !large;
  // Picked and full rows draw a thicker edge; the tear's notches match it.
  const edgeW = highlight || it.isFull ? 2 : StyleSheet.hairlineWidth;
  // Every value shows its age: the summary's comes from the leg that sets it.
  const summaryAge = summary ? routeSeatAge(it, now) : null;
  // Shown only while seat ages are on (off since round 124, John).
  const shownAge = SHOW_SEAT_AGE ? summaryAge : null;
  // The worst live thing on the route: the slim row's one tag. The route card has no banner for it; each
  // leg's own pill says it (John, 2026-11-02).
  const headline = statusHeadline(it, status);
  const ageWords = summaryAge ? summaryAge[0].toLowerCase() + summaryAge.slice(1) : null;
  const cardAge = ageWords ? `Seats ${ageWords}` : null;
  // A moved time (John, 2026-11-02): the schedule sits small and struck on its own line above, and the big
  // line keeps the times now, tinted, so the times never wrap onto two lines.
  const departMoved = !status?.canceled && !!(first?.struck && first.newText);
  const pendingArrival = !status?.canceled && !!status?.arrivalPending;
  const arriveMoved = !status?.canceled && !pendingArrival && !!status?.arrival;
  const times = (
    <View style={styles.shrink} testID="row-times-block">
      {departMoved || arriveMoved ? (
        <Text style={[textStyles.small, styles.struck, { color: hc.muted }]} numberOfLines={1} testID="row-was">
          {t.depart} – {t.arrive}
        </Text>
      ) : null}
      <Text
        style={[textStyles.number, { color: timeColor }]}
        numberOfLines={stacked ? undefined : 1}
        adjustsFontSizeToFit={!stacked}
        minimumFontScale={0.7}
        testID="row-times">
        {status?.canceled ? (
          // A canceled leg: the top times go grey, not struck; the leg's pill and struck times say it
          // (John, 2026-11-02).
          <Text style={{ color: hc.muted }} testID="row-times-canceled">
            {t.depart} – {t.arrive}
          </Text>
        ) : (
          <>
            {departMoved ? (
              <Text style={departTint} testID="row-new-depart">
                {keep(first!.newText!)}
              </Text>
            ) : (
              t.depart
            )}
            {' – '}
            {pendingArrival ? (
              // A diversion on the route: the arrival isn't known yet, like the leg's own TBD (John, 2026-11-02).
              <Text style={{ color: hc.muted }} testID="row-arrive-tbd">
                {ARRIVAL_TBD}
              </Text>
            ) : arriveMoved ? (
              <Text style={arriveTint} testID="row-new-arrive">
                {keep(status!.arrival!.newText)}
              </Text>
            ) : (
              t.arrive
            )}
          </>
        )}
        {t.plusDays ? <Text style={[textStyles.small, { color: hc.muted }]}> {t.plusDays}</Text> : null}
      </Text>
    </View>
  );
  // The chance word in its tier color; on the route card it's the headline, so it's bigger.
  // A canceled leg means the route can't be flown as listed, so it says that in grey instead of a
  // chance (John, 2026-11-02: it said "Likely" with a canceled first flight).
  const seatSummary = (lead: boolean) =>
    notFlyable ? (
      <View style={[styles.summary, lead && styles.summaryLead]} testID="seat-summary">
        <View style={[styles.summaryDot, { backgroundColor: hc.unknown }]} />
        <Text lineBreakStrategyIOS="push-out" style={[lead ? styles.badgeLead : styles.badge, { color: hc.muted }]}>
          {NOT_FLYABLE}
        </Text>
      </View>
    ) : summary ? (
      <View style={[styles.summary, lead && styles.summaryLead]} testID="seat-summary">
        <View style={[styles.summaryDot, { backgroundColor: dimmed ? hc.unknown : hc[it.tier] }]} />
        <Text
          lineBreakStrategyIOS="push-out"
          style={[lead ? styles.badgeLead : styles.badge, { color: dimmed ? hc.muted : hc[TIER_FG[it.tier]] }]}>
          {summary}
        </Text>
      </View>
    ) : (
      // Typical loads stay neutral (no tier word or color) but still say what's known.
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: hc.muted }]} testID="seat-neutral">
        {neutralSeatText(it, now)}
      </Text>
    );
  return (
    // Soft depth and a gentle press: the card shrinks a hair and dims a little (round 113). The
    // route view's big card stays still under the finger.
    <ScalePressable
      scaleTo={large ? 1 : CARD_PRESS_SCALE}
      pressedOpacity={large ? 1 : CARD_PRESSED_OPACITY}
      // In the route view the card doesn't close on a stray tap; "‹ Routes" does that.
      onPress={large ? undefined : withTick(() => onPress(it.id))}
      accessibilityRole={large ? undefined : 'button'}
      accessibilityState={large ? undefined : { selected }}
      testID={large ? 'route-card' : undefined}
      accessibilityLabel={label}
      accessibilityActions={actions.length ? actions : undefined}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === 'impact') onImpactPress?.(it.id);
        // The row is one VoiceOver element, so its leg buttons are reached as actions.
        const leg = name.startsWith('leg-') ? it.legs[Number(name.slice(4))] : undefined;
        if (leg) onLegPress?.(leg.flight);
      }}
      accessibilityHint={
        large ? undefined : selected ? 'Closes the route card' : 'Opens the route card and shows the route on the globe'
      }
      style={[
        styles.row,
        // Floating cards with a soft shadow (round 120, the Clean look).
        dimmed ? null : elevation.card,
        {
          // Full routes stay in time order, grayed with a red edge; text keeps full contrast.
          // The route view's card drops the selected tint so the Leave By card above it leads.
          // The picked row keeps white and gets an accent outline, as in the Clean look (round 120).
          backgroundColor: highlight ? c.surface : it.isFull || dimmed ? c.surface2 : c.surface,
          borderColor: highlight ? c.accent : it.isFull ? c.full : c.line,
          shadowColor: c.text,
        },
        (highlight || it.isFull) && styles.strongBorder,
      ]}>
      {/* Route color = weakest leg. */}
      {large ? null : <View style={[styles.edge, { backgroundColor: dimmed || notFlyable ? c.unknown : c[it.tier] }]} />}
      <View style={large ? styles.ticket : styles.content}>
        {selected ? (
          // Route card A (John, 2026-10-31): the seat chip up top, the times, then one box per flight.
          // In the route view (round 120, the Clean look): the chip, Save and the times up top, then the
          // flights in soft boxes, all on one white card.
          <>
            {(() => {
              const stubStyle = large ? [styles.stub, { backgroundColor: c.ink }] : styles.stubSlim;
              const headlineRow = (
                <View style={styles.headlineRow}>
                  <View style={[styles.headlineMain, styles.headlineStack]}>
                    {times}
                    <View style={[styles.line, styles.subLine]} testID="headline-row">
                      {seatSummary(false)}
                    </View>
                  </View>
                  <StopsStack stops={stopCount(it)} length={tripLength(it, status)} color={hc.muted} lead={hc.text} />
                  {topAction ? (
                    <View style={styles.topAction} testID="route-card-action">
                      {topAction}
                    </View>
                  ) : null}
                </View>
              );
              const stub = (
                <InkContext.Provider value={!!large}>
                  <View ref={stubRef} style={stubStyle} testID={large ? 'ticket-stub' : undefined}>
                    {headlineRow}
                  </View>
                </InkContext.Provider>
              );
              if (!large) return stub;
              const source: TearSource = {
                measure: (done) => stubRef.current?.measureInWindow(done),
                piece: () => (
                  <InkContext.Provider value>
                    <View style={[stubStyle, styles.tornCopy]}>{headlineRow}</View>
                  </InkContext.Provider>
                ),
                hold,
                paper: c.ink,
                edge: it.isFull ? c.full : c.line,
                edgeWidth: edgeW,
              };
              return (
                <TearSourceProvider value={source}>
                  <Animated.View
                    testID="ticket-stub-hold"
                    style={{
                      opacity: hold,
                      transform: [{ translateY: hold.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
                    }}>
                    {stub}
                  </Animated.View>
                </TearSourceProvider>
              );
            })()}
            {/* The route card tears like a boarding pass between its header and the flights (round 121). */}
            {large ? (
              <TicketTear notch={c.bg} edge={c.line} line={c.line2} />
            ) : (
              <TicketTear
                notch={c.bg}
                edge={c.line}
                line={c.line2}
                left={spacing.rowX + EDGE_W}
                right={spacing.rowX}
                edgeWidth={edgeW}
              />
            )}
            <View style={large ? styles.ticketBody : styles.stubSlim}>
              <LegTimeline itinerary={it} status={status} now={now} large={!!large} dimmed={dimmed} onLegPress={onLegPress} />
              {/* A new user won't know what "25/16" in a circle means (round 126, John), so the card says. */}
              {large && it.legs.some((l) => dotSeats(l.seats).includes('/')) ? (
                <Text style={[textStyles.small, styles.seatHint, { color: c.muted }]} testID="seat-circle-hint">
                  {SEAT_CIRCLE_HINT}
                </Text>
              ) : null}
              {cardAge && SHOW_SEAT_AGE ? (
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-age">
                  {cardAge}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {/* The seat chip stays beside the times on every row, struck or moved (John, 2026-11-02); at big
                text the times take the line and the seats go under them. */}
            <View style={[styles.line, !stacked && styles.lineKeep]} testID="top-line">
              {times}
              <View style={[styles.topRight, stacked ? styles.topRightStacked : styles.topRightKeep]} testID="top-right">
                {seatSummary(false)}
              </View>
            </View>
            {/* A boarding pass perforation between the times and the route (round 121, John). */}
            <TicketTear
              notch={c.bg}
              edge={c.line}
              line={c.line2}
              left={spacing.rowX + EDGE_W}
              right={spacing.rowX}
              edgeWidth={edgeW}
            />
            <View style={styles.line}>
              <View style={styles.path}>
                {saved ? (
                  <View testID="row-saved">
                    <Icon name="bookmark.fill" size={13} tintColor={c.accent} fallback={null} />
                  </View>
                ) : null}
                {/* The market as a mini route line (round 119, John picked it): ends big, stops above their dots. */}
                <MiniRoute airports={[it.origin, ...it.legs.map((l) => l.flight.to)]} dimmed={dimmed} />
              </View>
              {/* The stop count on top of the trip length (round 124, John), Nonstop too; the route line
                  already names the connections, so the stops line adds only short layovers. */}
              <StopsStack
                stops={slimStops(
                  it,
                  it.connections.map((_, k) => liveLayoverMin(it, status, k)),
                )}
                length={tripLength(it, status)}
                color={c.muted}
                lead={dimmed ? c.muted : c.text}
              />
            </View>
            {/* Slim row: who flies it and anything live; seats per leg live in the route card. One line of
                flights and at most one tag, which names the flight it means ("PHX → LAX delayed 40m"), so the
                row never stacks (John, 2026-10-31). */}
            <View style={styles.legLine} testID="flights-line">
              {it.legs.map((leg) => (
                <View key={leg.flight.id} style={styles.flight} testID="flight-item">
                  <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
                </View>
              ))}
              {headline ? (
                <View style={styles.flight} testID="row-tag">
                  <StatusTag label={headline.label} tone={headline.tone} />
                </View>
              ) : null}
              {shownAge ? (
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-age">
                  {shownAge}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </ScalePressable>
  );
});

/** The route color strip down a row's left edge. */
const EDGE_W = 5;

const styles = StyleSheet.create({
  // No overflow clip, so the soft shadow shows; the edge rounds its own corners instead.
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  shrink: { flexShrink: 1 },
  strongBorder: {
    borderWidth: 2,
  },
  edge: {
    width: EDGE_W,
    borderTopLeftRadius: radius.md - 1,
    borderBottomLeftRadius: radius.md - 1,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.rowY,
    paddingHorizontal: spacing.rowX,
    gap: spacing.group,
  },
  // The route view's big card (round 114 onward): no padding of its own; the header and body pad themselves.
  ticket: { flex: 1 },
  stub: {
    paddingTop: spacing.rowY,
    paddingBottom: 4,
    paddingHorizontal: spacing.rowX,
    gap: 4,
    borderTopLeftRadius: radius.md - 1,
    borderTopRightRadius: radius.md - 1,
  },
  // In the list, the picked row keeps its old stack: the same parts, no stub.
  stubSlim: { gap: spacing.group },
  seatHint: { fontSize: 12, lineHeight: 16 },
  // The flying copy of the header fills the piece that tore off.
  tornCopy: { flex: 1 },
  ticketBody: {
    paddingTop: 4,
    paddingBottom: spacing.rowY,
    paddingHorizontal: spacing.rowX,
    gap: spacing.group,
  },
  path: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.group,
  },
  lineKeep: { flexWrap: 'nowrap' },
  headlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.group },
  headlineMain: { flex: 1, minWidth: 0 },
  // The chance word, stops and trip length under the times: one small line, the dot and words
  // apart by a little more than a space (round 122).
  subLine: { justifyContent: 'flex-start', rowGap: 2 },
  // The stop count over the trip length, hugging the right end.
  stopsStack: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  stopsTop: { justifyContent: 'flex-end' },
  headlineStack: { gap: 2 },
  // A 44pt tap target that doesn't make the headline line taller: it overhangs into the card's padding.
  topAction: { marginVertical: -8, marginRight: -10 },
  topRight: {
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.group,
  },
  topRightKeep: { flexShrink: 0 },
  topRightStacked: {
    flexBasis: '100%',
    justifyContent: 'flex-start',
  },
  // The seat chance as a colored dot and word, no fill (round 120, the Clean look). Long seat text
  // wraps instead of being cut off by the row's rounded edge.
  summary: {
    flexShrink: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // The route card's headline: bigger, so it reads first.
  summaryLead: { gap: 8 },
  summaryDot: { width: 7, height: 7, borderRadius: 3.5 },
  badge: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  badgeLead: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22 },
  // A leg's airports, bold and calm (round 120).
  legCodes: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  legLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    flexWrap: 'wrap',
  },
  flight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  // Timeline (design round 56; boxes since round 80): the line runs unbroken from dot to dot.
  leg: { flexDirection: 'row', gap: spacing.group },
  railCol: { width: DOT, alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dotText: { fontFamily: fonts.bodySemiBold, fontSize: 11, fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  railLine: { flex: 1, width: 2, minHeight: 4 },
  railHalf: { flex: 1, width: 2 },
  // One flight: a tinted box you tap to open the flight (John, 2026-11-01).
  legBox: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm + 2,
  },
  // A leg's tag and flight chip, above (first flight) or below (later flights) its time.
  legMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.group, rowGap: 2 },
  chipCol: { alignItems: 'flex-start' },
  connection: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.group },
  struck: { textDecorationLine: 'line-through' },
  legLineRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.group },
  legLineWrap: { flexWrap: 'wrap' },
});
