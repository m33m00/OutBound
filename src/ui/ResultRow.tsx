import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Flight, Itinerary, SeatTier } from '@/engine';
import type { RouteImpact } from '@/live';
import { formatDuration, nearbyNotes, rowAccessibilityLabel, rowTimes, seatText, stopCount } from '@/search/format';
import { impactSummary } from '@/search/impactText';
import type { LegStatusView, LegTagKind, RowStatus } from '@/search/statusTags';
import { fonts, radius, spacing, textStyles, useColors, type ColorToken } from '@/theme';

import { AirlinePill } from './AirlinePill';
import { ImpactBadge } from './ImpactBadge';
import { pressStyle } from './press';
import { TONE_BG, TONE_FG, type Tone } from './statusTone';
import { withTick } from './haptics';

/** Tier text and fill tokens; color is never the only signal (word + number). */
const TIER_FG: Record<SeatTier, ColorToken> = {
  wide: 'wideFg',
  good: 'goodFg',
  okay: 'okayFg',
  tight: 'tightFg',
  full: 'fullFg',
  unknown: 'unknownFg',
};
const TIER_BG: Record<SeatTier, ColorToken> = {
  wide: 'wideBg',
  good: 'goodBg',
  okay: 'okayBg',
  tight: 'tightBg',
  full: 'fullBg',
  unknown: 'unknownBg',
};

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
}

/** Row tag kind to tone (Q-050). */
const TONE: Record<LegTagKind, Tone> = {
  delayed: 'delayed',
  departed: 'gone',
  arrived: 'gone',
  canceled: 'canceled',
  diverted: 'canceled',
};

function StatusTag({ label, tone }: { label: string; tone: Tone }) {
  const c = useColors();
  return (
    <View
      style={[styles.statusTag, { backgroundColor: c[TONE_BG[tone]], borderColor: tone === 'gone' ? c.line2 : c[TONE_BG[tone]] }]}>
      {/* Icon keeps Canceled / Diverted from reading as a Full-tier red edge; the word stays. */}
      {tone === 'canceled' ? (
        <SymbolView name="xmark.circle" size={12} tintColor={c[TONE_FG[tone]]} fallback={null} />
      ) : null}
      <Text style={[textStyles.small, styles.tagWord, { color: c[TONE_FG[tone]] }]}>{label}</Text>
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
}: ResultRowProps) {
  const c = useColors();
  const t = rowTimes(it);
  const hasImpact = impact != null && impact.level !== 'none';
  const label = [
    rowAccessibilityLabel(it, now),
    ...(status?.spoken ?? []),
    hasImpact ? impactSummary(impact, now) : '',
  ]
    .filter(Boolean)
    .join('. ');
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
  // Departed rows are dimmed with a gray fill and edge; text keeps 4.5:1.
  const dimmed = !!status?.dimmed;
  const timeColor = dimmed ? c.muted : c.text;
  return (
    <Pressable
      onPress={withTick(() => onPress(it.id))}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityActions={actions.length ? actions : undefined}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === 'impact') onImpactPress?.(it.id);
        // The row is one VoiceOver element, so its leg buttons are reached as actions.
        const leg = name.startsWith('leg-') ? it.legs[Number(name.slice(4))] : undefined;
        if (leg) onLegPress?.(leg.flight);
      }}
      accessibilityHint={selected ? 'Tap to clear the route from the globe' : 'Shows this route on the globe'}
      style={pressStyle([
        styles.row,
        {
          // Full routes stay in time order, grayed with a red edge; text keeps full contrast.
          backgroundColor: selected ? c.accentSoft : it.isFull || dimmed ? c.surface2 : c.surface,
          borderColor: selected ? c.accent : it.isFull ? c.full : c.line,
        },
        (selected || it.isFull) && styles.strongBorder,
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
            ) : first?.struck && first.newText ? (
              <>
                <Text style={[styles.struck, { color: c.muted }]}>{t.depart}</Text> {first.newText} – {t.arrive}
              </>
            ) : (
              <>
                {t.depart} – {t.arrive}
              </>
            )}
            {t.plusDays ? <Text style={[textStyles.small, { color: c.muted }]}> {t.plusDays}</Text> : null}
          </Text>
          <View style={styles.badgeSlot} testID="badge-slot">
            {hasImpact ? (
              <ImpactBadge impact={impact} now={now} onPress={() => onImpactPress?.(it.id)} />
            ) : impactLoading ? (
              <Text style={[textStyles.small, { color: c.muted }]}>Checking…</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.line}>
          <Text style={[textStyles.bodyStrong, { color: c.text }]}>
            {[it.origin, ...it.legs.map((l) => l.flight.to)].join(' → ')}
          </Text>
          <Text style={[textStyles.body, { color: c.muted }]}>
            {/* The route line already names the connections. */}
            {stopCount(it)} · {formatDuration(it.totalMin)}
          </Text>
        </View>
        {it.legs.map((leg, i) => {
          const view = status?.legs[i];
          const risk = status?.risks.find((r) => r.index === i);
          const body = (
            <>
              <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
              {view?.tag ? <StatusTag label={view.tag.label} tone={TONE[view.tag.kind]} /> : null}
              {/* Leg 0's struck / new time is in the top time line; show it once. */}
              {view && i > 0 ? <LegTime view={view} /> : null}
              <View
                style={[
                  styles.tierChip,
                  { backgroundColor: leg.seats.source === 'typical' ? c.surface2 : c[TIER_BG[leg.seats.tier]] },
                ]}>
                <Text
                  style={[
                    textStyles.small,
                    { color: leg.seats.source === 'typical' ? c.muted : c[TIER_FG[leg.seats.tier]] },
                  ]}>
                  {seatText(leg.seats, now)}
                </Text>
              </View>
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
              ) : null}
            </View>
          );
        })}
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
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.group,
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
  legBlock: {
    gap: 6,
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
  tagWord: { fontFamily: fonts.bodySemiBold },
  struck: { textDecorationLine: 'line-through' },
  tierChip: {
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
