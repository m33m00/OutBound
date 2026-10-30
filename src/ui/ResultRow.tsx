import { memo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { Flight, Itinerary } from '@/engine';
import type { RouteImpact } from '@/live';
import {
  forSpeech,
  formatDuration,
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
import type { LegStatusView, LegTagKind, RowStatus } from '@/search/statusTags';
import { fonts, radius, spacing, textStyles, useBoldText, useColors } from '@/theme';

import { AirlinePill } from './AirlinePill';
import { Icon } from './Icon';
import { ImpactBadge } from './ImpactBadge';
import { pressStyle } from './press';
import { TONE_BG, TONE_FG, type Tone } from './statusTone';
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

/** Row tag kind to tone (Q-050). */
const TONE: Record<LegTagKind, Tone> = {
  delayed: 'delayed',
  departed: 'gone',
  arrived: 'gone',
  canceled: 'canceled',
  diverted: 'canceled',
};

/** From this text size the seat chip and delay badge sit left-aligned under the times. */
export const STACK_TOP_LINE_SCALE = 1.3;

/** "7:05 AM" never splits between the number and AM/PM, so a long time line only wraps at the dash. */
const keep = (time: string) => time.replace(/ /g, '\u00a0');

function StatusTag({ label, tone }: { label: string; tone: Tone }) {
  const c = useColors();
  return (
    <View
      style={[styles.statusTag, { backgroundColor: c[TONE_BG[tone]], borderColor: tone === 'gone' ? c.line2 : c[TONE_BG[tone]] }]}>
      {/* Icon keeps Canceled / Diverted from reading as a Full-tier red edge; the word stays. */}
      {tone === 'canceled' ? (
        <Icon name="xmark.circle" size={12} tintColor={c[TONE_FG[tone]]} fallback={null} />
      ) : null}
      <Text style={[textStyles.small, styles.shrink, { fontFamily: fonts.bodySemiBold, color: c[TONE_FG[tone]] }]}>{label}</Text>
    </View>
  );
}

/** Leg departure time: struck through when delayed or canceled, with the new time after it. */
function LegTime({ view }: { view: LegStatusView }) {
  const c = useColors();
  if (!view.struck) return null;
  return (
    <Text style={[textStyles.small, { color: c.muted }]}>
      <Text style={styles.struck}>{view.scheduledText}</Text>
      {view.newText ? <Text style={{ color: c.text }}> {view.newText}</Text> : null}
    </Text>
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
  // Departed rows are dimmed with a gray fill and edge; text keeps 4.5:1.
  const dimmed = !!status?.dimmed;
  const timeColor = dimmed ? c.muted : c.text;
  const neutralSeats = (source: string) => dimmed || source === 'typical';
  const legText = large ? textStyles.body : textStyles.small;
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
                {first?.struck && first.newText ? (
                  <>
                    <Text style={[styles.struck, { color: c.muted }]}>{t.depart}</Text> {keep(first.newText)}
                  </>
                ) : (
                  t.depart
                )}
                {' – '}
                {/* A late arrival shows like a late departure: old time struck, new time after it. */}
                {status?.arrival ? (
                  <>
                    <Text style={[styles.struck, { color: c.muted }]}>{t.arrive}</Text> {keep(status.arrival.newText)}
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
                <Text style={[textStyles.bodyStrong, { color: dimmed ? c.muted : c[TIER_FG[it.tier]] }]}>{summary}</Text>
              </View>
            ) : (
              // Typical loads stay neutral (no tier word or color) but still say what's known.
              <Text style={[textStyles.small, { color: c.muted }]} testID="seat-neutral">
                {neutralSeatText(it, now)}
              </Text>
            )}
            <View style={styles.badgeSlot} testID="badge-slot">
              {hasImpact ? (
                <ImpactBadge impact={impact} now={now} onPress={() => onImpactPress?.(it.id)} />
              ) : impactLoading ? (
                <Text style={[textStyles.small, { color: c.muted }]}>Checking…</Text>
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
            <Text style={[textStyles.bodyStrong, styles.shrink, { color: c.text }]}>
              {[it.origin, ...it.legs.map((l) => l.flight.to)].join(' → ')}
            </Text>
          </View>
          <Text style={[textStyles.body, { color: c.muted }]}>
            {/* The route line already names the connections; the slim row adds short layovers. */}
            {selected ? stopCount(it) : slimStops(it)} · {formatDuration(it.totalMin)}
          </Text>
        </View>
        {selected ? (
          // Route card (Q-062): each leg with its seats and status, and each connection.
          it.legs.map((leg, i) => {
            const view = status?.legs[i];
            const risk = status?.risks.find((r) => r.index === i);
            const connection = it.connections[i];
            const body = (
              <>
                <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} large={large} />
                <Text style={[legText, { color: c.muted }]}>
                  {leg.flight.from} → {leg.flight.to}
                </Text>
                {view?.tag ? <StatusTag label={view.tag.label} tone={TONE[view.tag.kind]} /> : null}
                {/* Leg 0's struck / new time is in the top time line; show it once. */}
                {view && i > 0 ? <LegTime view={view} /> : null}
                {legDetailOnly ? (
                  <Text style={[legText, { color: c.muted }]}>{seatSourceText(leg.seats, now)}</Text>
                ) : (
                  <View
                    style={[
                      styles.tierChip,
                      {
                        backgroundColor: dimmed
                          ? c.surface
                          : leg.seats.source === 'typical'
                            ? c.surface2
                            : c[TIER_BG[leg.seats.tier]],
                      },
                    ]}>
                    <Text
                      style={[
                        legText,
                        // A route that already left keeps its seat words but drops the tier colors.
                        { color: neutralSeats(leg.seats.source) ? c.muted : c[TIER_FG[leg.seats.tier]] },
                      ]}>
                      {seatText(leg.seats, now)}
                    </Text>
                  </View>
                )}
              </>
            );
            const line = onLegPress ? (
              <Pressable
                onPress={() => onLegPress(leg.flight)}
                accessibilityRole="button"
                accessibilityLabel={[
                  `Flight status, ${leg.flight.airline} ${leg.flight.flightNumber}, ${leg.flight.from} to ${leg.flight.to}`,
                  view?.tag?.spoken,
                ]
                  .filter(Boolean)
                  .join(', ')}
                style={pressStyle([styles.legLine, styles.legTap], 'link')}>
                {body}
                <Icon name="chevron.right" size={12} tintColor={c.muted} fallback={null} />
              </Pressable>
            ) : (
              <View style={styles.legLine}>{body}</View>
            );
            return (
              <View key={leg.flight.id} style={styles.legBlock}>
                {line}
                {/* At the connecting airport, i.e. after the inbound leg (Q-050). */}
                {risk ? (
                  <View style={styles.legLine}>
                    <StatusTag label={`Connection at risk · ${risk.airport}`} tone="delayed" />
                  </View>
                ) : connection ? (
                  <Text style={[legText, styles.connection, { color: c.muted, borderColor: c.line2 }]}>
                    Connect at {connection.airport} · {formatDuration(connection.layoverMin)}
                    {connection.sameAirline ? '' : ' · change airlines'}
                  </Text>
                ) : null}
              </View>
            );
          })
        ) : (
          // Slim row: who flies it and anything live; seats per leg live in the route card.
          <View style={styles.legLine} testID="flights-line">
            {it.legs.map((leg, i) => {
              const tag = status?.legs[i]?.tag;
              return (
                <View key={leg.flight.id} style={styles.flight}>
                  <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
                  {tag ? <StatusTag label={tag.label} tone={TONE[tag.kind]} /> : null}
                </View>
              );
            })}
            {status?.risks.map((r) => (
              <StatusTag key={r.index} label={`Connection at risk · ${r.airport}`} tone="delayed" />
            ))}
            {summaryAge ? (
              <Text style={[textStyles.small, { color: c.muted }]} testID="seat-age">
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
  legTap: {
    minHeight: 44,
  },
  flight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connection: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
  },
  legBlock: {
    gap: spacing.group,
  },
  statusTag: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  struck: { textDecorationLine: 'line-through' },
  tierChip: {
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
