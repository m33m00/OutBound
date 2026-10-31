import { memo } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, useWindowDimensions, View } from 'react-native';

import { AIRPORTS, type Flight, type Itinerary } from '@/engine';
import type { RouteImpact } from '@/live';
import {
  forSpeech,
  formatDuration,
  formatTime,
  nearbyNotes,
  neutralSeatText,
  routeSeatAge,
  routeSeatSummary,
  rowAccessibilityLabel,
  rowTimes,
  seatSourceText,
  seatText,
  slimStops,
  stopCount,
} from '@/search/format';
import { impactSummary } from '@/search/impactText';
import type { LegStatusView, RowStatus } from '@/search/statusTags';
import { fonts, radius, spacing, textStyles, useBoldText, useColors } from '@/theme';

import { AirlinePill } from './AirlinePill';
import { Icon } from './Icon';
import { ImpactBadge } from './ImpactBadge';
import { pressStyle } from './press';
import { StatusTag, TAG_TONE } from './StatusTag';
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
}

/** From this text size the seat chip and delay badge sit left-aligned under the times. */
export const STACK_TOP_LINE_SCALE = 1.3;

/** "7:05 AM" never splits between the number and AM/PM, so a long time line only wraps at the dash. */
const keep = (time: string) => time.replace(/ /g, '\u00a0');

/** A leg's scheduled departure at its origin, e.g. "8:00 AM". */
const legDepartText = (leg: Flight) => formatTime(leg.departUtc, AIRPORTS[leg.from]?.tz ?? 'UTC');

/** Size of the dot that marks each leg on the route card's timeline. */
const DOT = 10;
/** Space above and below each leg's text on the timeline. */
const LEG_PAD = 4;

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

/** The time a leg line shows: the new time when it moved, none when canceled or diverted, else the schedule. */
export function legClockText(leg: Flight, view?: LegStatusView): string | null {
  if (!view?.struck) return legDepartText(leg);
  return view.newText;
}

/**
 * The route card's legs (design round 56, John asked for stops to read at a glance):
 * a thin line down the left with a dot per leg in that leg's seat color. Each leg is one
 * tap target: departure time, airports and flight on the first line, its seats under them.
 * Each connection is a short line between legs. The route's overall seats stay in the
 * chip at the top, so legs carry plain colored text, not a second chip.
 */
function LegTimeline({
  itinerary: it,
  status,
  now,
  large,
  dimmed,
  sourceOnly,
  onLegPress,
}: {
  itinerary: Itinerary;
  status?: RowStatus;
  now: number;
  large: boolean;
  dimmed: boolean;
  /** A nonstop: the top chip already says the seats, so its leg keeps only the source and age. */
  sourceOnly: boolean;
  onLegPress?: (flight: Flight) => void;
}) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  const text = large ? textStyles.body : textStyles.small;
  // Centers the dot on the first line, whatever the text size: that line is as tall as the
  // taller of its text and the flight pill (small text plus 2pt padding top and bottom).
  const firstLine = Math.max((text.lineHeight ?? 20) * fontScale, (textStyles.small.lineHeight ?? 16) * fontScale + 4);
  const dotTop = LEG_PAD + Math.max(0, (firstLine - DOT) / 2);
  const rail = { backgroundColor: c.line2 };
  return (
    <View testID="leg-timeline">
      {it.legs.map((leg, i) => {
        const view = status?.legs[i];
        const risk = status?.risks.find((r) => r.index === i);
        const connection = it.connections[i];
        const last = i === it.legs.length - 1;
        const typical = leg.seats.source === 'typical' || leg.seats.source === 'unknown';
        // The dot carries the tier color (tier colors only as fills or large numbers); the words stay plain.
        const seatColor = dimmed || typical ? c.muted : c.text;
        const dotColor = dimmed || typical ? c.unknown : c[leg.seats.tier];
        const seats = sourceOnly ? seatSourceText(leg.seats, now) : seatText(leg.seats, now);
        const body = (
          <>
            <View style={styles.railCol}>
              <View style={[styles.dot, { marginTop: dotTop, backgroundColor: dotColor }]} testID="leg-dot" />
              {last ? null : <View style={[styles.railLine, rail]} />}
            </View>
            <View style={styles.legText}>
              <View style={styles.legTop}>
                <Text style={[text, styles.shrink, { color: c.muted }]}>
                  <LegClock leg={leg.flight} view={view} text={text} dimmed={dimmed} />
                  {`${legClockText(leg.flight, view) ? '  ' : ''}${leg.flight.from}\u00a0→\u00a0${leg.flight.to}`}
                </Text>
                <View style={styles.legFlight}>
                  <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
                  {onLegPress ? <Icon name="chevron.right" size={12} tintColor={c.muted} fallback={null} /> : null}
                </View>
              </View>
              {view?.tag || seats ? (
                <View style={styles.legSeats}>
                  {view?.tag ? <StatusTag label={view.tag.label} tone={TAG_TONE[view.tag.kind]} /> : null}
                  {seats ? (
                    <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.shrink, { color: seatColor }]}>
                      {seats}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        );
        return (
          <View key={leg.flight.id}>
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
                style={pressStyle([styles.leg, styles.legTap], 'link')}>
                {body}
              </Pressable>
            ) : (
              <View style={styles.leg}>{body}</View>
            )}
            {/* At the connecting airport, i.e. after the inbound leg (Q-050). */}
            {last ? null : (
              <View style={styles.leg}>
                <View style={styles.railCol}>
                  <View style={[styles.railLine, rail]} />
                </View>
                <View style={[styles.legText, styles.connection]}>
                  {risk ? (
                    <StatusTag label={`Connection at risk · ${risk.airport}`} tone="delayed" />
                  ) : connection ? (
                    <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
                      Connect at {connection.airport} · {formatDuration(connection.layoverMin)}
                      {connection.sameAirline ? '' : ' · change airlines'}
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
  // Seats lead the top line (Q-059); the delay badge sits after them.
  const summary = routeSeatSummary(it);
  // A nonstop's summary already says its tier and number; its leg line keeps only the source and age.
  const legDetailOnly = summary != null && it.legs.length === 1;
  const first = status?.legs[0];
  const tagged = !!status?.legs.some((l) => l.tag) || !!status?.risks.length;
  // Departed rows are dimmed with a gray fill and edge; text keeps 4.5:1.
  const dimmed = !!status?.dimmed;
  const timeColor = dimmed ? c.muted : c.text;
  const highlight = selected && !large;
  // Every value shows its age: the summary's comes from the leg that sets it.
  const summaryAge = summary ? routeSeatAge(it, now) : null;
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
        <View style={styles.line}>
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
                    <Text style={[styles.was, styles.struck, { color: c.muted }]}>{keep(t.depart)}</Text>{'\u00a0'}{keep(first.newText)}
                  </>
                ) : (
                  t.depart
                )}
                {' – '}
                {/* A late arrival shows like a late departure: old time small and struck, then the new time. */}
                {status?.arrival ? (
                  <>
                    <Text style={[styles.was, styles.struck, { color: c.muted }]}>{keep(t.arrive)}</Text>{'\u00a0'}{keep(status.arrival.newText)}
                  </>
                ) : (
                  t.arrive
                )}
              </>
            )}
            {t.plusDays ? <Text style={[textStyles.small, { color: c.muted }]}> {t.plusDays}</Text> : null}
          </Text>
          {/* At big text the times take the line; seats and the delay badge go under them. */}
          <View style={[styles.topRight, stacked && styles.topRightStacked]} testID="top-right">
            {summary ? (
              <View
                style={[styles.summary, { backgroundColor: dimmed ? c.surface : c[TIER_BG[it.tier]] }]}
                testID="seat-summary">
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: dimmed ? c.muted : c[TIER_FG[it.tier]] }]}>{summary}</Text>
              </View>
            ) : (
              // Typical loads stay neutral (no tier word or color) but still say what's known.
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-neutral">
                {neutralSeatText(it, now)}
              </Text>
            )}
            <View style={styles.badgeSlot} testID="badge-slot">
              {hasImpact ? (
                <ImpactBadge impact={impact} onPress={() => onImpactPress?.(it.id)} />
              ) : impactLoading ? (
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>Checking…</Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.line}>
          <View style={styles.path}>
            {/* The route view's header bookmark already says it; the list shows a small one. */}
            {saved && !large ? (
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
            {selected ? stopCount(it) : slimStops(it)} · {formatDuration(it.totalMin)}
          </Text>
        </View>
        {selected ? (
          // Route card (Q-062): one leg per line on a thin timeline, connections between (design round 56).
          <LegTimeline
            itinerary={it}
            status={status}
            now={now}
            large={!!large}
            dimmed={dimmed}
            sourceOnly={legDetailOnly}
            onLegPress={onLegPress}
          />
        ) : (
          // Slim row: who flies it and anything live; seats per leg live in the route card.
          // Any live tag (delayed, canceled, departed…) stacks the flights one per line, each
          // with its own tag beside it, so it's clear which leg it means (John, 2026-10-30).
          <View style={tagged ? styles.flightsStacked : styles.legLine} testID="flights-line">
            {it.legs.map((leg, i) => {
              const tag = status?.legs[i]?.tag;
              return (
                <View key={leg.flight.id} style={styles.flight} testID="flight-item">
                  <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
                  {tag ? <StatusTag label={tag.label} tone={TAG_TONE[tag.kind]} /> : null}
                </View>
              );
            })}
            {status?.risks.map((r) => (
              <View key={r.index} style={styles.flight}>
                <StatusTag label={`Connection at risk · ${r.airport}`} tone="delayed" />
              </View>
            ))}
            {summaryAge ? (
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="seat-age">
                {summaryAge}
              </Text>
            ) : null}
          </View>
        )}
        {nearbyNotes(it).map((note) => (
          <Text key={note} style={[textStyles.small, { color: c.muted }]}>
            {note}
          </Text>
        ))}
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
  flightsStacked: { gap: 4, alignItems: 'flex-start' },
  // Timeline (design round 56): rows touch so the line runs unbroken from leg to leg.
  leg: { flexDirection: 'row', gap: spacing.section },
  legTap: { minHeight: 44 },
  railCol: { width: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  railLine: { flex: 1, width: 2, minHeight: 4 },
  legText: { flex: 1, gap: 2, paddingVertical: LEG_PAD },
  legTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: spacing.group, rowGap: 2 },
  // Pinned right, even when it wraps under the time at big text.
  legFlight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  legSeats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.group },
  connection: { paddingVertical: 6 },
  struck: { textDecorationLine: 'line-through' },
  // The replaced time inside the big time line: small, so the new time carries the weight.
  was: { fontFamily: textStyles.small.fontFamily, fontSize: textStyles.small.fontSize },
});
