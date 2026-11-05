import { type ComponentRef, memo, type ReactNode, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, type TextStyle, useWindowDimensions, View } from 'react-native';

import { AIRPORTS, aircraftLabel, type Flight, type Itinerary, type LegSeats } from '@/engine';
import type { RouteImpact } from '@/live';
import {
  forSpeech,
  formatDuration,
  formatTime,
  neutralSeatText,
  routeSeatAge,
  SHOW_SEAT_AGE,
  rowAccessibilityLabel,
  rowTimes,
  seatText,
  shortLayovers,
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
import { Divided, MetaLine } from './MetaLine';
import { MiniRoute } from './MiniRoute';
import { snapshotCard, TearSourceProvider, type TearSource } from './TearAway';
import { TearSwipe, TearSwipeCard } from './TearSwipe';
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
  /** A control pinned top right: Save on each result ticket since round 151 (John). */
  topAction?: ReactNode;
  /** Swiping left tears the ticket along its perforation and calls this: on a result ticket since round 151. */
  onSwipeSave?: () => void;
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
 * known; "20" for a typical load (no "~", round 138); a dash when there's no data.
 */
export function dotSeats(seats: LegSeats): string {
  if (seats.source === 'unknown' || seats.netSeats == null) return '–';
  if (seats.source === 'typical') return `${Math.max(0, seats.netSeats)}`;
  if (seats.openSeats != null && seats.listed != null) return `${seats.openSeats}/${seats.listed}`;
  return `${Math.max(0, seats.netSeats)}`;
}

/**
 * The same numbers as `dotSeats`, each tagged with what it counts so the route line can put a tiny seat
 * or person icon over it (round 147, John). A lone number is seats left after the list.
 */
export function seatCounts(seats: LegSeats): { kind: 'seats' | 'listed'; value: string }[] {
  if (seats.source === 'unknown' || seats.netSeats == null) return [];
  if (seats.source !== 'typical' && seats.openSeats != null && seats.listed != null)
    return [
      { kind: 'seats', value: `${seats.openSeats}` },
      { kind: 'listed', value: `${seats.listed}` },
    ];
  return [{ kind: 'seats', value: `${Math.max(0, seats.netSeats)}` }];
}

/** A result card's edge (round 150, John: "a more obvious ticket border"). */
export const CARD_EDGE_W = 1;

/** Space above and below a connection label, before any extra that centers it on the line. */
const CONNECTION_PAD = 6;
/** How far the airport pills rise when a status pill sits over the line, so the line stays level with them. */
const ENDS_LIFT = 10;

/**
 * One flight as its two ends (round 132, John: "It just looks like a bunch of text on one row. Is there
 * no way to introduce pills or containers"): the leave time over the from airport on the left, the
 * arrive time over the to airport on the right, each airport in its own small pill, and a line with a
 * plane between them carrying the flight's length. A nonstop's times are the header's, so its box shows
 * only the airports.
 */
function LegEnds({
  leg,
  view,
  dimmed,
  showTimes,
  tag,
}: {
  leg: Flight;
  view?: LegStatusView;
  dimmed: boolean;
  showTimes: boolean;
  /** The flight's status pill, centered just above its route line (round 136, John). */
  tag?: ReactNode;
}) {
  const c = useColors();
  const t = legTimesText(leg, view);
  const canceled = view?.tag?.kind === 'canceled';
  const tint = (min: number | null) => {
    const token = dimmed || canceled ? null : shiftToken(min);
    return dimmed || canceled ? c.muted : token ? c[token] : c.text;
  };
  const departColor = tint(view?.newUtc != null ? shiftMinutes(view.newUtc, view.scheduledUtc) : null);
  const arriveColor = t.pending ? c.muted : tint(view?.arrival ? shiftMinutes(view.arrival.newUtc, leg.arriveUtc) : null);
  const strong = { fontFamily: fonts.mono, fontVariant: ['tabular-nums' as const] };
  const minutes = Math.round((leg.arriveUtc - leg.departUtc) / 60_000);
  const time = (text: string, color: string, testID: string, right?: boolean) => (
    <Text
      style={[styles.endTime, strong, { color }, right && styles.endRight, canceled && styles.struck]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      testID={testID}>
      {keep(text)}
    </Text>
  );
  const code = (text: string) => (
    <View style={[styles.codePill, { backgroundColor: c.surface, borderColor: c.line }]} testID="leg-code">
      <Text style={[styles.codeText, { color: dimmed ? c.muted : c.text }]}>{text}</Text>
    </View>
  );
  const length =
    minutes > 0 ? (
      <Text style={[styles.endsLength, { color: c.muted }]} numberOfLines={1} testID="leg-length">
        {formatDuration(minutes)}
      </Text>
    ) : null;
  // With a pill over the line, the flight's length moves under it, and the airport pills rise to
  // stay level with the line.
  const lift = tag ? styles.endColLifted : null;
  return (
    <View style={styles.ends} testID="leg-line">
      <View style={[styles.endCol, lift]}>
        {showTimes ? time(t.depart, departColor, 'leg-clock') : null}
        {code(leg.from)}
      </View>
      <View style={[styles.endsMid, tag ? styles.endsMidTagged : null]} testID="leg-track">
        {tag ? (
          <View style={styles.endsTag} testID="leg-tag">
            {tag}
          </View>
        ) : (
          length
        )}
        <View style={styles.endsTrack}>
          <View style={[styles.endsLine, { backgroundColor: c.line2 }]} />
          <Icon
            name="airplane"
            size={11}
            tintColor={c.faint}
            fallback={<Text style={[styles.endsLength, { color: c.faint }]}>✈</Text>}
          />
          <View style={[styles.endsLine, { backgroundColor: c.line2 }]} />
        </View>
        {tag ? length : null}
      </View>
      <View style={[styles.endCol, styles.endColRight, lift]}>
        {showTimes ? time(t.arrive, arriveColor, 'leg-arrive', true) : null}
        {code(leg.to)}
      </View>
    </View>
  );
}

/**
 * The stop count on top of the trip length, right-aligned (round 124, John: "Can the number of stops
 * be listed on top of the time? Even when it says Nonstop?"). A short layover rides on the stops
 * line after a thin divider.
 */
function StopsStack({
  stops,
  length,
  color,
  lead,
  start,
}: {
  stops: string;
  length: string | null;
  color: string;
  lead: string;
  /** Left-aligned, when it sits under the times at big text sizes. */
  start?: boolean;
}) {
  return (
    <View style={[styles.stopsStack, start && styles.stopsStackStart]} testID="row-stops">
      <MetaLine
        text={stops}
        gap={6}
        style={start ? styles.stopsTopStart : styles.stopsTop}
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
  const rail = { backgroundColor: c.line2 };
  // Each box's measured height. Its dot sits at its middle, so the line between two dots runs
  // half of one box, the connection, and half of the next; the label is placed at its middle.
  const [legHeights, setLegHeights] = useState<Record<number, number>>({});
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
        // The flight chip on its own row; any status pill sits over the route line (round 136, John).
        const pills = (
          <View style={styles.legMeta} testID="leg-flight">
            <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
            {/* Aircraft type beside the chip, when the schedule has it (round 138, John). */}
            {aircraftLabel(leg.flight.aircraft) ? (
              <View style={styles.aircraft} testID="leg-aircraft">
                <Icon name="airplane" size={11} tintColor={c.muted} fallback={null} />
                <Text style={[textStyles.small, { color: c.muted }]}>{aircraftLabel(leg.flight.aircraft)}</Text>
              </View>
            ) : null}
          </View>
        );
        const content = (
          <>
            {/* The flight's two ends: times over airport pills, a plane between (round 132, John). */}
            <LegEnds
              leg={leg.flight}
              view={view}
              dimmed={dimmed}
              showTimes={!nonstop}
              tag={view?.tag ? <StatusTag label={view.tag.label} tone={TAG_TONE[view.tag.kind]} /> : undefined}
            />
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
                  {/* The tag marks a connection the live times squeeze or break; it sits on top,
                      both centered with the flight boxes (round 136, John). */}
                  {risk ? <StatusTag label={layover < 0 ? 'Missed' : 'At risk'} tone="delayed" /> : null}
                  {connection ? (
                    <Text
                      lineBreakStrategyIOS="push-out"
                      style={[textStyles.small, styles.connectionText, { color: c.muted }]}
                      testID="leg-connection-text">
                      {connectionText(connection, layover, it.legs[i + 1]?.flight.airline)}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  measureLayout: (to: never, ok: (x: number, y: number, w: number, h: number) => void, fail?: () => void) => void;
};

/** Where the dashed line is on screen, worked out from where it sits inside the whole card. */
export function measurePerfOn(
  perf: unknown,
  whole: unknown,
  done: (x: number, y: number, width: number, height: number) => void,
) {
  const p = perf as Measurable | null;
  const w = whole as Measurable | null;
  if (!p) return done(0, 0, 0, 0);
  if (!w) return p.measureInWindow(done);
  try {
    p.measureLayout(
      w as never,
      (x, y, pw, ph) => w.measureInWindow((wx, wy) => done(wx + x, wy + y, pw, ph)),
      () => p.measureInWindow(done),
    );
  } catch {
    p.measureInWindow(done);
  }
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
  onSwipeSave,
}: ResultRowProps) {
  const c = useColors();
  const scheme = useColorSchemeName();
  // The route card's header tears off along its perforation when you save it (round 126, John); this
  // hides the real header while its copy flies into My Trips, then eases it back.
  const stubRef = useRef<ComponentRef<typeof View>>(null);
  const hold = useRef(new Animated.Value(1)).current;
  // The whole card, hidden while its copy bends in your hands and tears (round 129).
  const ticketRef = useRef<ComponentRef<typeof View>>(null);
  const wholeRef = useRef<ComponentRef<typeof Animated.View>>(null);
  const perfRef = useRef<ComponentRef<typeof View>>(null);
  const cardHold = useRef(new Animated.Value(1)).current;
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
  const first = status?.legs[0];
  // Departed rows are dimmed with a gray fill and edge; text keeps 4.5:1. A canceled route fades to gray the
  // same way, with a solid gray edge like any ticket's (round 153, John: no dashes), while its canceled leg
  // keeps the red X and pill (round 152, John picked the gray fade: red stays for full flights).
  const canceledRoute = !!status?.canceled;
  const dimmed = !!status?.dimmed || canceledRoute;
  const notFlyable = !!status?.canceled;
  const slimLength = tripLength(it, status);
  const shortLeft = shortLayovers(
    it,
    it.connections.map((_, k) => liveLayoverMin(it, status, k)),
  );
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
  // Picked and full rows draw a thicker edge; the tear's notches match it. Every other card has a full
  // point of a darker edge, so each ticket stands apart when scanning, in dark mode too (round 150, John).
  const edgeW = highlight || (it.isFull && !canceledRoute) ? 2 : CARD_EDGE_W;
  // The card's edge color where it isn't picked or full; the tear's notches outline in it too.
  const edgeColor = canceledRoute ? c.faint : c.cardEdge;
  // Every value shows its age: the summary's comes from the leg that sets it.
  const summaryAge = it.tier !== 'unknown' ? routeSeatAge(it, now) : null;
  // Shown only while seat ages are on (off since round 124, John).
  const shownAge = SHOW_SEAT_AGE ? summaryAge : null;
  // The worst live thing on the route: the slim row's one tag. The route card has no banner for it; each
  // leg's own pill says it (John, 2026-11-02).
  const headline = statusHeadline(it, status);
  // Canceled legs, connections at risk, delays and diversions are all drawn on the route line now (rounds
  // 143 to 146, John), so the row's own tag is left only for a route whose first flight has gone.
  const rowTag = headline?.tone === 'gone' ? headline : null;
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
  // The flights under the perforation; the save tear draws a copy of it too (round 129).
  const ticketBodyView = (
    <View style={large ? styles.ticketBody : styles.stubSlim}>
      <LegTimeline itinerary={it} status={status} now={now} large={!!large} dimmed={dimmed} onLegPress={onLegPress} />
      {cardAge && SHOW_SEAT_AGE ? (
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-age">
          {cardAge}
        </Text>
      ) : null}
    </View>
  );
  // The slim ticket (rounds 119 to 151): the times and stops above the perforation, the route line under it.
  // It tears along its perforation to save, like the route card did before round 151.
  const slimStub = (
    <>
      {/* The seat chip stays beside the times on every row, struck or moved (John, 2026-11-02); at big
            text the times take the line and the seats go under them. */}
      <View style={styles.slimTopRow}>
        <View style={[styles.line, styles.slimTopMain, !stacked && styles.lineKeep]} testID="top-line">
          {times}
        </View>
        {/* Save sits on the ticket itself now (round 151, John: "We already have the space to put a save
              icon on the top right"). */}
        {topAction ? (
          <View style={styles.topAction} testID="row-action">
            {topAction}
          </View>
        ) : null}
      </View>
      {/* Stops, a short layover and the trip length on one line of their own under the times, so the
            times keep their width and the route line below gets the whole card at any stop count
            (round 142, after round 141 squeezed them beside the times). No verdict word: a canceled
            leg's own red tag says it. */}
      <Text
        lineBreakStrategyIOS="push-out"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[textStyles.small, styles.stopsLine, { color: c.muted }]}
        testID="row-stops">
        {/* Always stops, then trip time, then a short connection last (round 149, John). */}
        <Text style={{ color: dimmed ? c.muted : c.text, fontFamily: fonts.bodyMedium }} testID="row-stop-count">
          {stopCount(it)}
        </Text>
        {slimLength ? <Divided text={` · ${slimLength}`} /> : null}
        {shortLeft ? (
          <Text style={{ color: dimmed ? c.muted : c.text, fontFamily: fonts.bodyMedium }} testID="row-short-layover">
            <Divided text={` · ${shortLeft}`} />
          </Text>
        ) : null}
      </Text>
    </>
  );
  const slimBody = (
    <>
      <View style={styles.line}>
        <View style={styles.path}>
          {saved && !topAction ? (
            <View testID="row-saved">
              <Icon name="bookmark.fill" size={13} tintColor={c.muted} fallback={null} />
            </View>
          ) : null}
          {/* The market as a mini route line (round 119, John picked it): ends big, stops above their dots. */}
          <MiniRoute
            airports={[it.origin, ...it.legs.map((l) => l.flight.to)]}
            dimmed={dimmed}
            stopFlags={it.connections.map((_, k) =>
              status?.risks.some((r) => r.index === k) ? (liveLayoverMin(it, status, k) < 0 ? 'Missed' : 'At risk') : null,
            )}
            legs={it.legs.map((l, i) => {
              // Each leg in its seat color with its numbers over it (round 140, John): no chance word,
              // the person weighs the numbers. Typical loads, no data, canceled and departed stay gray.
              const gray =
                dimmed ||
                l.seats.source === 'typical' ||
                l.seats.source === 'unknown' ||
                status?.legs[i]?.tag?.kind === 'canceled';
              const tier = gray ? 'unknown' : l.seats.tier;
              // A canceled leg is red with an X on it (round 143, John), with no numbers over it; a
              // no-data leg shows no label either (a lone dash said nothing, round 142).
              const canceled = status?.legs[i]?.tag?.kind === 'canceled';
              // The leg's flight and aircraft sit under its stretch of line (round 145, John).
              const flight = {
                airline: l.flight.airline,
                number: l.flight.flightNumber,
                aircraft: aircraftLabel(l.flight.aircraft),
              };
              if (canceled) return { color: c.canceled, text: c.canceledFg, label: '', canceled: true, flight };
              const blank = l.seats.source === 'unknown';
              // A delay or diversion rides over its own leg, above the seats (round 146, John).
              const tag = status?.legs[i]?.tag;
              const flag = tag && (tag.kind === 'delayed' || tag.kind === 'diverted') ? tag.label : null;
              return {
                color: c[tier],
                text: c[TIER_FG[tier]],
                label: blank ? '' : dotSeats(l.seats),
                counts: seatCounts(l.seats),
                flag,
                flight,
              };
            })}
          />
        </View>
      </View>
      {/* Slim row: who flies it and anything live; seats per leg live in the route card. One line of
            flights and at most one tag, which names the flight it means ("PHX → LAX delayed 40m"), so the
            row never stacks (John, 2026-10-31). */}
      {/* The flights live under their legs on the route line now (round 145, John); this line keeps only
            a live tag (delays, a diversion) and the seat age when ages are on. */}
      {rowTag || shownAge ? (
        <View style={styles.legLine} testID="flights-line">
          {/* A connection at risk is flagged on its stop and a canceled leg is drawn red with an X on the
              route line now (round 143, John), so the row's tag skips both ("Drop the tag", round 144).
              VoiceOver still says it. */}
          {rowTag ? (
            <View style={styles.flight} testID="row-tag">
              <StatusTag label={rowTag.label} tone={rowTag.tone} />
            </View>
          ) : null}
          {shownAge ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-age">
              {shownAge}
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
  const slimPaper = it.isFull || dimmed ? c.surface2 : c.surface;
  const slimSource: TearSource | null =
    large || selected
      ? null
      : {
          measure: (done) => stubRef.current?.measureInWindow(done),
          measureCard: (done) => ticketRef.current?.measureInWindow(done),
          measureWhole: (done) => wholeRef.current?.measureInWindow(done),
          measurePerf: (done) => measurePerfOn(perfRef.current, wholeRef.current, done),
          snapshot: () => snapshotCard(wholeRef),
          piece: () => <View style={[styles.slimStub, styles.tornCopy]}>{slimStub}</View>,
          body: () => (
            <>
              <TicketTear notch={c.bg} edge={edgeColor} line={c.line2} edgeWidth={edgeW} />
              <View style={styles.slimBody}>{slimBody}</View>
            </>
          ),
          hold,
          cardHold,
          paper: slimPaper,
          bodyPaper: slimPaper,
          edge: it.isFull && !canceledRoute ? c.full : edgeColor,
          edgeWidth: edgeW,
        };
  // Set while the route card draws its stub, so the swipe strip on the perforation tears the same card.
  let tearSource: TearSource | null = null;
  const card = (
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
          borderColor: highlight ? c.accent : canceledRoute ? edgeColor : it.isFull ? c.full : c.cardEdge,
          shadowColor: c.text,
        },
        // A touch more lift in light mode; dark mode leans on the edge, where a shadow can't show.
        !dimmed && (scheme === 'dark' ? styles.flatDark : styles.liftLight),
        (highlight || (it.isFull && !canceledRoute)) && styles.strongBorder,
      ]}>
      {/* No colored edge since round 140: the route line carries each leg's color now, and a full route keeps
          its red outline. */}
      <View ref={ticketRef} style={large ? styles.ticket : styles.content}>
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
                    {/* The seat chance sits above the times as a small pill, like a ticket's class, not
                        under them (round 132, John: "I don't like that the Likely indicator is below the
                        time"). */}
                    {times}
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
              const source: TearSource = (tearSource = {
                measure: (done) => stubRef.current?.measureInWindow(done),
                measureCard: (done) => ticketRef.current?.measureInWindow(done),
                // The whole card as a picture, so the tear bends the real thing (round 132).
                measureWhole: (done) => wholeRef.current?.measureInWindow(done),
                // Measured inside the card itself, then put on screen with the card, so the dashes'
                // place on the card picture is exact (round 136, John: "It still doesn't cut along the line").
                measurePerf: (done) => measurePerfOn(perfRef.current, wholeRef.current, done),
                snapshot: () => snapshotCard(wholeRef),
                piece: () => (
                  <InkContext.Provider value>
                    <View style={[stubStyle, styles.tornCopy]}>{headlineRow}</View>
                  </InkContext.Provider>
                ),
                body: () => (
                  <>
                    <TicketTear notch={c.bg} edge={edgeColor} line={c.line2} edgeWidth={edgeW} />
                    {ticketBodyView}
                  </>
                ),
                hold,
                cardHold,
                paper: c.ink,
                bodyPaper: it.isFull ? c.surface2 : c.surface,
                edge: it.isFull && !canceledRoute ? c.full : edgeColor,
                edgeWidth: edgeW,
              });
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
              // Above the flights below it, so the swipe strip reaches a little into them too.
              <View style={styles.tearLine}>
                <View ref={perfRef} collapsable={false} testID="tear-perf">
                  <TicketTear notch={c.bg} edge={edgeColor} line={c.line2} edgeWidth={edgeW} />
                </View>
                {/* Swipe left along the perforation to tear the stub off and save (round 133, John). */}
                {tearSource ? <TearSwipe source={tearSource} onSave={onSwipeSave} /> : null}
              </View>
            ) : (
              <TicketTear
                notch={c.bg}
                edge={edgeColor}
                line={c.line2}
                left={spacing.rowX}
                right={spacing.rowX}
                edgeWidth={edgeW}
              />
            )}
            {ticketBodyView}
          </>
        ) : (
          <>
            <TearSourceProvider value={slimSource}>
              <Animated.View
                testID="row-stub-hold"
                style={{
                  opacity: hold,
                  transform: [{ translateY: hold.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
                }}>
                <View ref={stubRef} collapsable={false} style={styles.slimStub}>
                  {slimStub}
                </View>
              </Animated.View>
              {/* A boarding pass perforation between the times and the route (round 121, John). */}
              <View ref={perfRef} collapsable={false}>
                <TicketTear
                  notch={c.bg}
                  edge={edgeColor}
                  line={c.line2}
                  left={spacing.rowX}
                  right={spacing.rowX}
                  edgeWidth={edgeW}
                />
              </View>
              {slimBody}
            </TearSourceProvider>
          </>
        )}
      </View>
    </ScalePressable>
  );
  // The route card hides while its 3D copy bends and tears on the flying layer (round 129).
  // Since round 151 a result ticket tears and saves too, on a swipe left anywhere on it.
  return large ? (
    <Animated.View ref={wholeRef} collapsable={false} style={{ opacity: cardHold }} testID="route-card-hold">
      {card}
    </Animated.View>
  ) : (
    <Animated.View ref={wholeRef} collapsable={false} style={{ opacity: cardHold }} testID="row-card-hold">
      <TearSwipeCard source={slimSource} onSave={slimSource ? onSwipeSave : undefined}>
        {card}
      </TearSwipeCard>
    </Animated.View>
  );
});

/** The route color strip down a row's left edge. */
const EDGE_W = 5;

const styles = StyleSheet.create({
  tearLine: { zIndex: 2 },
  // No overflow clip, so the soft shadow shows; the edge rounds its own corners instead.
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: CARD_EDGE_W,
    minHeight: 44,
  },
  shrink: { flexShrink: 1 },
  strongBorder: {
    borderWidth: 2,
  },
  liftLight: { shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  flatDark: { shadowOpacity: 0 },
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
  // The flying copy of the header fills the piece that tore off.
  tornCopy: { flex: 1 },
  // The slim ticket's parts keep the gap the card's content had between them.
  slimStub: { gap: spacing.group },
  slimBody: { gap: spacing.group },
  slimTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.group },
  slimTopMain: { flex: 1, minWidth: 0 },
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
  // The stop count over the trip length, hugging the right end.
  stopsStack: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '45%' },
  stopsTop: { justifyContent: 'flex-end' },
  stopsStackStart: { alignItems: 'flex-start', maxWidth: '100%' },
  stopsTopStart: { justifyContent: 'flex-start' },
  // A size up from the small text (round 146, John: "blow up the text a little bit more").
  stopsLine: { marginTop: 3, fontSize: 14, lineHeight: 19 },
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
  legLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  aircraft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  connection: { flex: 1, alignItems: 'center', gap: 4 },
  connectionText: { textAlign: 'center', alignSelf: 'stretch' },
  struck: { textDecorationLine: 'line-through' },
  // A flight's two ends (round 132): time over an airport pill on each side, a plane line between.
  ends: { flexDirection: 'row', alignItems: 'flex-end', columnGap: 8 },
  endCol: { alignItems: 'flex-start', gap: 4, flexShrink: 1 },
  endColRight: { alignItems: 'flex-end' },
  endTime: { fontSize: 15, lineHeight: 20 },
  endRight: { textAlign: 'right' },
  codePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  codeText: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 17, letterSpacing: 0.4 },
  endsMid: { flex: 1, minWidth: 40, alignItems: 'center', paddingBottom: 6, gap: 1 },
  // Pill, line, then length: the line stays level with the airport pills' middles.
  endsMidTagged: { paddingBottom: 0, gap: 2 },
  endsTag: { maxWidth: '100%', marginBottom: 1 },
  endColLifted: { marginBottom: ENDS_LIFT },
  endsLength: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14 },
  endsTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 4 },
  endsLine: { flex: 1, height: 1 },
  // The seat chance as a small outlined pill above the route card's times (round 132).
  chanceLine: { marginBottom: 2 },
  chancePill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
});
