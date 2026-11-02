import { memo, type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, useWindowDimensions, View } from 'react-native';

import { AIRPORTS, type Flight, type Itinerary } from '@/engine';
import type { RouteImpact } from '@/live';
import {
  forSpeech,
  formatDuration,
  formatTime,
  neutralSeatText,
  routeSeatAge,
  routeSeatSummary,
  rowAccessibilityLabel,
  rowTimes,
  seatText,
  slimStops,
  stopCount,
} from '@/search/format';
import { statusHeadline, type StatusHeadline } from '@/search/headline';
import { impactSummary } from '@/search/impactText';
import type { LegStatusView, RowStatus } from '@/search/statusTags';
import { fonts, radius, spacing, textStyles, useBoldText, useColors } from '@/theme';

import { AirlinePill } from './AirlinePill';
import { Icon } from './Icon';
import { ImpactBadge } from './ImpactBadge';
import { pressStyle } from './press';
import { StatusTag, TAG_TONE } from './StatusTag';
import { TONE_BG, TONE_FG } from './statusTone';
import { withTick } from './haptics';
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

/** Size of the dot that marks each leg on the route card's timeline. */
const DOT = 10;
/** Space above and below a connection label, before any extra that centers it on the line. */
const CONNECTION_PAD = 6;

/**
 * A leg's departure on the timeline. The struck original lives only in the card's top time
 * line (John, 2026-10-30), so a delayed leg shows just its new time and a canceled one none.
 */
function LegClock({ leg, view, text, dimmed }: { leg: Flight; view?: LegStatusView; text: TextStyle; dimmed: boolean }) {
  const c = useColors();
  const time = legClockText(leg, view);
  if (!time) return null;
  return <Text style={[text, { fontFamily: fonts.bodySemiBold, color: dimmed ? c.muted : c.text }]}>{keep(time)}</Text>;
}

/** The time a leg line shows: the new time when it moved, none when canceled, else the schedule (a diversion keeps it). */
/**
 * Width every leg's status tag is widened to, so the flight chips that follow line up: the widest
 * measured tag, once all `tagged` legs have reported. Undefined until then (tags show at their own size).
 */
export function tagColumnWidth(widths: Record<number, number>, tagged: number): number | undefined {
  const measured = Object.values(widths);
  if (tagged < 2 || measured.length < tagged) return undefined;
  return Math.ceil(Math.max(...measured));
}

export function legClockText(leg: Flight, view?: LegStatusView): string | null {
  if (!view?.struck) return legDepartText(leg);
  return view.newText;
}

/**
 * The route card's legs (design round 56; slimmed in round 66, John picked A on 2026-10-31).
 * Since round 80 (John, 2026-11-01) each flight is its own box, so it's plain that you tap it
 * to open the flight: no caret. A thin line runs down the left with a dot per flight, centered
 * on its box, in that flight's seat color. Inside the box: the first flight's tag and flight
 * chip above its time and airports, every later flight's below (round 76). Between boxes, the
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
  const text = large ? textStyles.body : textStyles.small;
  const rail = { backgroundColor: c.line2 };
  // Each box's measured height. Its dot sits at its middle, so the line between two dots runs
  // half of one box, the connection, and half of the next; the label is placed at its middle.
  const [legHeights, setLegHeights] = useState<Record<number, number>>({});
  // Each leg's status tag is widened to the widest one so the flight chips after them line up
  // (John, 2026-11-02). Widths are kept per set of labels, so a tag that gets shorter re-measures.
  const tagKey = it.legs.map((_, i) => status?.legs[i]?.tag?.label ?? '').join('|');
  const [tagWidths, setTagWidths] = useState<{ key: string; widths: Record<number, number> }>({ key: tagKey, widths: {} });
  const widths = tagWidths.key === tagKey ? tagWidths.widths : {};
  const tagColumn = tagColumnWidth(widths, it.legs.filter((_, i) => status?.legs[i]?.tag).length);
  const measureTag = (i: number) => (e: { nativeEvent: { layout: { width: number } } }) => {
    const w = e.nativeEvent.layout.width;
    setTagWidths((prev) => {
      const base = prev.key === tagKey ? prev.widths : {};
      return base[i] === w && prev.key === tagKey ? prev : { key: tagKey, widths: { ...base, [i]: w } };
    });
  };
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
        const last = i === it.legs.length - 1;
        const typical = leg.seats.source === 'typical' || leg.seats.source === 'unknown';
        // The dot carries the leg's tier color; the route's chance word is in the headline.
        const dotColor = dimmed || typical ? c.unknown : c[leg.seats.tier];
        const above = i === 0;
        const pills = (
          <View style={styles.legMeta} testID="leg-flight">
            {view?.tag ? (
              <StatusTag
                label={view.tag.label}
                tone={TAG_TONE[view.tag.kind]}
                minWidth={tagColumn}
                onLayout={tagColumn ? undefined : measureTag(i)}
              />
            ) : null}
            <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
          </View>
        );
        const content = (
          <>
            {above ? pills : null}
            <Text style={[text, { color: c.muted }]}>
              <LegClock leg={leg.flight} view={view} text={text} dimmed={dimmed} />
              {`${legClockText(leg.flight, view) ? '  ' : ''}${leg.flight.from}\u00a0→\u00a0${leg.flight.to}`}
            </Text>
            {/* A diversion goes on to the planned airport, late (John, 2026-11-01). */}
            {view?.tag?.kind === 'diverted' ? (
              <Text style={[textStyles.small, { color: c.muted }]} testID="leg-diverted-note">
                {`Continuing to ${leg.flight.to} · new arrival time pending`}
              </Text>
            ) : null}
            {above ? null : pills}
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
                <View style={[styles.dot, { backgroundColor: dotColor }]} testID="leg-dot" />
                <View style={[styles.railHalf, !last && rail]} />
              </View>
              {onLegPress ? (
                <Pressable
                  onPress={() => onLegPress(leg.flight)}
                  accessibilityRole="button"
                  // The label replaces what's inside, so it says the leg's time and seats too.
                  accessibilityLabel={[
                    `Flight status, ${leg.flight.airline} ${leg.flight.flightNumber}, ${leg.flight.from} to ${leg.flight.to}`,
                    // A canceled leg's tag already says "Canceled, was 10:40 AM".
                    legClockText(leg.flight, view) ? `departs ${legClockText(leg.flight, view)}` : null,
                    view?.tag?.spoken,
                    forSpeech(seatText(leg.seats, now)),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  testID="leg-box"
                  style={pressStyle(boxStyle)}>
                  {content}
                </Pressable>
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
                    <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.shrink, { color: c.muted }]}>
                      {formatDuration(connection.layoverMin)} connection at {connection.airport}
                      {connection.sameAirline ? '' : ' · change airlines'}
                    </Text>
                  ) : null}
                  {/* The headline names the airport; here the tag just marks which connection. */}
                  {risk ? <StatusTag label="At risk" tone="delayed" /> : null}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** The route card's live-problem headline: big, in the tag's colors (canceled, delayed or gone). */
function Headline({ headline }: { headline: StatusHeadline }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.summary,
        styles.summaryLead,
        styles.headline,
        {
          backgroundColor: c[TONE_BG[headline.tone]],
          borderColor: headline.tone === 'gone' ? c.line2 : c[TONE_BG[headline.tone]],
        },
      ]}
      testID="headline">
      {headline.tone === 'canceled' ? (
        <Icon name="xmark.circle" size={18} tintColor={c[TONE_FG[headline.tone]]} fallback={null} />
      ) : null}
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, styles.shrink, { color: c[TONE_FG[headline.tone]] }]}>
        {headline.label}
      </Text>
    </View>
  );
}

export const ResultRow = memo(function ResultRow({
  itinerary: it,
  selected,
  now,
  onPress,
  impact,
  impactLoading,
  onImpactPress,
  onLegPress,
  status,
  large,
  saved,
  topAction,
}: ResultRowProps) {
  const c = useColors();
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
  const timeColor = dimmed ? c.muted : c.text;
  const highlight = selected && !large;
  // Every value shows its age: the summary's comes from the leg that sets it.
  const summaryAge = summary ? routeSeatAge(it, now) : null;
  // Route card: a live problem leads; then the seats line at the bottom says the chance word too.
  // The worst live thing on the route: the card's headline, and the slim row's one tag.
  const headline = statusHeadline(it, status);
  const ageWords = summaryAge ? summaryAge[0].toLowerCase() + summaryAge.slice(1) : null;
  const cardAge = !ageWords ? null : headline ? `Seats: ${summary} · ${ageWords}` : `Seats ${ageWords}`;
  const times = (
    <Text style={[textStyles.number, { color: timeColor }]} testID="row-times">
      {status?.canceled ? (
        <Text style={styles.struck}>
          {t.depart} – {t.arrive}
        </Text>
      ) : (
        <>
          {/* The new time is full size; the old one sits small and struck before it (John, 2026-10-30). */}
          {first?.struck && first.newText ? (
            <>
              <Text style={[styles.was, styles.struck, { color: c.muted }]}>{keep(t.depart)}</Text>
              {'\u00a0'}
              {keep(first.newText)}
            </>
          ) : (
            t.depart
          )}
          {' – '}
          {/* A late arrival shows like a late departure: old time small and struck, then the new time. */}
          {status?.arrival ? (
            <>
              <Text style={[styles.was, styles.struck, { color: c.muted }]}>{keep(t.arrive)}</Text>
              {'\u00a0'}
              {keep(status.arrival.newText)}
            </>
          ) : (
            t.arrive
          )}
        </>
      )}
      {t.plusDays ? <Text style={[textStyles.small, { color: c.muted }]}> {t.plusDays}</Text> : null}
    </Text>
  );
  // The chance word in its tier color; on the route card it's the headline, so it's bigger.
  const seatSummary = (lead: boolean) =>
    summary ? (
      <View
        style={[styles.summary, lead && styles.summaryLead, { backgroundColor: dimmed ? c.surface : c[TIER_BG[it.tier]] }]}
        testID="seat-summary">
        <Text
          lineBreakStrategyIOS="push-out"
          style={[lead ? textStyles.heading : textStyles.bodyStrong, { color: dimmed ? c.muted : c[TIER_FG[it.tier]] }]}>
          {summary}
        </Text>
      </View>
    ) : (
      // Typical loads stay neutral (no tier word or color) but still say what's known.
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-neutral">
        {neutralSeatText(it, now)}
      </Text>
    );
  const badge = (
    <View style={styles.badgeSlot} testID="badge-slot">
      {hasImpact ? (
        <ImpactBadge impact={impact} onPress={() => onImpactPress?.(it.id)} />
      ) : impactLoading ? (
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          Checking…
        </Text>
      ) : null}
    </View>
  );
  return (
    <Pressable
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
      style={pressStyle([
        styles.row,
        {
          // Full routes stay in time order, grayed with a red edge; text keeps full contrast.
          // The route view's card drops the selected tint so the Leave By card above it leads.
          backgroundColor: highlight ? c.accentSoft : it.isFull || dimmed ? c.surface2 : c.surface,
          borderColor: highlight ? c.accent : it.isFull ? c.full : c.line,
        },
        (highlight || it.isFull) && styles.strongBorder,
      ])}>
      {/* Route color = weakest leg. */}
      <View style={[styles.edge, { backgroundColor: dimmed ? c.unknown : c[it.tier] }]} />
      <View style={styles.content}>
        {selected ? (
          // Route card A (John, 2026-10-31): one headline up top, the times, then one line per flight.
          <>
            {/* Save sits top right of the card, outside the headline's wrapping line (John, 2026-11-01). */}
            <View style={styles.headlineRow}>
              <View style={[styles.line, styles.headlineMain]} testID="headline-row">
                {headline ? <Headline headline={headline} /> : seatSummary(true)}
                {badge}
              </View>
              {topAction ? (
                <View style={styles.topAction} testID="route-card-action">
                  {topAction}
                </View>
              ) : null}
            </View>
            <View style={styles.line}>
              {times}
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>
                {stopCount(it)} · {formatDuration(it.totalMin)}
              </Text>
            </View>
            <LegTimeline itinerary={it} status={status} now={now} large={!!large} dimmed={dimmed} onLegPress={onLegPress} />
            {cardAge ? (
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-age">
                {cardAge}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.line}>
              {times}
              {/* At big text the times take the line; seats and the delay badge go under them. */}
              <View style={[styles.topRight, stacked && styles.topRightStacked]} testID="top-right">
                {seatSummary(false)}
                {badge}
              </View>
            </View>
            <View style={styles.line}>
              <View style={styles.path}>
                {saved ? (
                  <View testID="row-saved">
                    <Icon name="bookmark.fill" size={13} tintColor={c.accent} fallback={null} />
                  </View>
                ) : null}
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, styles.shrink, { color: c.text }]}>
                  {[it.origin, ...it.legs.map((l) => l.flight.to)].join(' → ')}
                </Text>
              </View>
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>
                {/* The route line already names the connections; the slim row adds short layovers. */}
                {slimStops(it)} · {formatDuration(it.totalMin)}
              </Text>
            </View>
            // Slim row: who flies it and anything live; seats per leg live in the route card. // One line of flights and at most
            one tag, which names the flight it means // ("PHX → LAX delayed 40m"), so the row never stacks (John, 2026-10-31).
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
              {summaryAge ? (
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-age">
                  {summaryAge}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 44,
  },
  shrink: { flexShrink: 1 },
  strongBorder: {
    borderWidth: 2,
  },
  edge: {
    width: 5,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.rowY,
    paddingHorizontal: spacing.rowX,
    gap: spacing.group,
  },
  path: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.group,
  },
  headlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.group },
  headlineMain: { flex: 1 },
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
  topRightStacked: {
    flexBasis: '100%',
    justifyContent: 'flex-start',
  },
  // Long seat text wraps inside the chip instead of being cut off by the row's rounded edge.
  summary: {
    flexShrink: 1,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  // The route card's headline chip: bigger, so it reads first.
  summaryLead: { paddingHorizontal: 10, paddingVertical: 4 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  badgeSlot: {
    flexShrink: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 20,
  },
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
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  railLine: { flex: 1, width: 2, minHeight: 4 },
  railHalf: { flex: 1, width: 2 },
  // One flight: a tinted box you tap to open the flight (John, 2026-11-01).
  legBox: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  // A leg's tag and flight chip, above (first flight) or below (later flights) its time.
  legMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.group, rowGap: 2 },
  connection: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.group },
  struck: { textDecorationLine: 'line-through' },
  // The replaced time inside the big time line: small, so the new time carries the weight.
  was: { fontFamily: textStyles.small.fontFamily, fontSize: textStyles.small.fontSize },
});
