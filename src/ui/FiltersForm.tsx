import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';

import { AIRPORTS, isUsAirline, TIME_OF_DAY_WINDOW, TIMES_OF_DAY, type AirlineRegion, type TimeOfDay } from '@/engine';
import { SORT_BY, type SortBy } from '@/search/arrange';
import { LIMITS, type SearchFilters } from '@/settings/settings';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { AIRLINE_MARKS, AirlineMark } from './AirlinePill';
import { AirportPicker } from './AirportPicker';
import { PillButton } from './Buttons';
import { Stepper } from './Stepper';
import { pressStyle } from './press';
import { withTick } from './haptics';
import { useSheetContent } from './useSheetContent';

const TIME_LABEL: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

/** "5 AM", "12 PM", on the 12-hour clock John uses. */
export function hourLabel(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "5 AM to 12 PM" for a time-of-day pill. */
export function timeWindowText(t: TimeOfDay): string {
  const { start, end } = TIME_OF_DAY_WINDOW[t];
  return `${hourLabel(start)} to ${hourLabel(end)}`;
}

/** Airlines to pick from: the ones the app knows by name, US ones only when US airlines is on. */
export function airlineChoices(region: AirlineRegion): string[] {
  return Object.keys(AIRLINE_MARKS)
    .filter((a) => region === 'all' || isUsAirline(a))
    .sort((a, b) => AIRLINE_MARKS[a].name.localeCompare(AIRLINE_MARKS[b].name));
}

const SORT_LABEL: Record<SortBy, string> = { departure: 'Departure', seats: 'Most seats', arrival: 'Arrival' };

const SORT_SPOKEN: Record<SortBy, string> = {
  departure: 'Sort by departure',
  seats: 'Sort by most seats',
  arrival: 'Sort by arrival',
};

/** What the picked order does, under the Sort by control. */
export const SORT_CAPTION: Record<SortBy, string> = {
  departure: 'Earliest departure first. Routes that already left sit at the top.',
  seats: 'The route whose fullest flight has the most seats comes first. Routes with no loads yet go after.',
  arrival: 'Earliest arrival first, with the new time when a flight runs late.',
};

const toggle = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Search filter controls, shared by the Filters panel and Settings. */
export function FiltersForm({ filters: f, onChange }: { filters: SearchFilters; onChange: (f: SearchFilters) => void }) {
  const c = useColors();
  const set = (patch: Partial<SearchFilters>) => onChange({ ...f, ...patch });
  // Four labelled options don't fit one row at big text: two by two from 1.3x.
  const grid = useWindowDimensions().fontScale >= 1.3;
  return (
    <View style={styles.form}>
      {/* Itinerary preferences (Jayden, 2026-11-13): these order and hide the routes found, so changing
          them never runs the search again. */}
      <View style={styles.block}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
          Sort by
        </Text>
        <View style={[styles.segments, { backgroundColor: c.surface2 }]} accessibilityRole="radiogroup" testID="filters-sort">
          {SORT_BY.map((sortBy) => {
            const on = f.sortBy === sortBy;
            return (
              <Pressable
                key={sortBy}
                testID={`filters-sort-${sortBy}`}
                onPress={withTick(() => set({ sortBy }))}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={SORT_SPOKEN[sortBy]}
                style={pressStyle([styles.segment, { backgroundColor: on ? c.accent : 'transparent' }])}>
                <Text
                  style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.accent }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}>
                  {SORT_LABEL[sortBy]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="filters-sort-caption">
          {SORT_CAPTION[f.sortBy]}
        </Text>
      </View>

      <View style={styles.block}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
          Canceled flights
        </Text>
        <Pressable
          testID="filters-canceled"
          onPress={() => set({ showCanceled: !f.showCanceled })}
          accessibilityRole="switch"
          accessibilityState={{ checked: f.showCanceled }}
          accessibilityLabel="Show canceled routes"
          accessibilityHint="Show routes where a flight is canceled"
          style={pressStyle([styles.switchRow, { backgroundColor: c.surface2 }])}>
          <View style={styles.flex}>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
              Show canceled routes
            </Text>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
              Routes where a flight is canceled
            </Text>
          </View>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Switch value={f.showCanceled} trackColor={{ true: c.accent, false: c.faint }} />
          </View>
        </Pressable>
      </View>

      <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
        Max stops
      </Text>
      {/* One track with the pick filled, like an iOS segmented control (round 165). */}
      <View style={[styles.segments, grid && styles.grid, { backgroundColor: c.surface2 }]} accessibilityRole="radiogroup">
        {[0, 1, 2, 3].map((n) => {
          const on = f.maxStops === n;
          return (
            <Pressable
              key={n}
              onPress={withTick(() => set({ maxStops: n }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={n === 0 ? 'Nonstop only' : `Up to ${n} ${n === 1 ? 'stop' : 'stops'}`}
              style={pressStyle([
                styles.segment,
                grid && styles.segmentGrid,
                { backgroundColor: on ? c.accent : 'transparent' },
              ])}>
              {/* Units on every option, so "2" never reads as a count of something else. */}
              <Text
                style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.accent }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}>
                {n === 0 ? 'Nonstop' : `${n} ${n === 1 ? 'stop' : 'stops'}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Round 174 filters (John, 2026-11-07). */}
      <View style={styles.block}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
          Departure Time
        </Text>
        <View style={styles.pills} testID="filters-times">
          {TIMES_OF_DAY.map((t) => (
            <TogglePill
              key={t}
              testID={`filters-time-${t}`}
              on={f.departTimes.includes(t)}
              label={TIME_LABEL[t]}
              caption={timeWindowText(t)}
              wide
              onPress={() => set({ departTimes: TIMES_OF_DAY.filter((x) => (x === t) !== f.departTimes.includes(x)) })}
            />
          ))}
        </View>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          When the first flight leaves, local time. None picked means any time.
        </Text>
      </View>

      <View style={styles.block}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
          Airlines
        </Text>
        <View style={[styles.segments, { backgroundColor: c.surface2 }]} accessibilityRole="radiogroup" testID="filters-region">
          {(['all', 'us'] as const).map((region) => {
            const on = f.airlineRegion === region;
            return (
              <Pressable
                key={region}
                testID={`filters-region-${region}`}
                onPress={withTick(() =>
                  set({ airlineRegion: region, airlines: region === 'us' ? f.airlines.filter(isUsAirline) : f.airlines }),
                )}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={region === 'all' ? 'All airlines' : 'US airlines only'}
                style={pressStyle([styles.segment, { backgroundColor: on ? c.accent : 'transparent' }])}>
                <Text
                  style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.accent }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}>
                  {region === 'all' ? 'All airlines' : 'US airlines'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.pills} testID="filters-airlines">
          {airlineChoices(f.airlineRegion).map((a) => (
            <TogglePill
              key={a}
              testID={`filters-airline-${a}`}
              on={f.airlines.includes(a)}
              label={AIRLINE_MARKS[a].name}
              leading={<AirlineMark airline={a} size={20} />}
              onPress={() => set({ airlines: toggle(f.airlines, a) })}
            />
          ))}
        </View>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          Pick airlines to see only them, on every flight. None picked means every airline.
        </Text>
      </View>

      <View style={styles.block}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
          Loads
        </Text>
        <Pressable
          testID="filters-answered"
          onPress={() => set({ answeredOnly: !f.answeredOnly })}
          accessibilityRole="switch"
          accessibilityState={{ checked: f.answeredOnly }}
          accessibilityLabel="Only answered loads"
          accessibilityHint="Only routes where every flight has seats someone reported"
          style={pressStyle([styles.switchRow, { backgroundColor: c.surface2 }])}>
          <View style={styles.flex}>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
              Only answered loads
            </Text>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
              Every flight has seats someone reported
            </Text>
          </View>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Switch value={f.answeredOnly} trackColor={{ true: c.accent, false: c.faint }} />
          </View>
        </Pressable>
      </View>

      <AvoidAirports codes={f.avoidAirports} onChange={(avoidAirports) => set({ avoidAirports })} />

      <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
        Connections
      </Text>
      <Stepper
        label="Same airline, at least"
        value={f.minConnectSameAirlineMin}
        {...LIMITS.minConnectSameAirlineMin}
        onChange={(v) => set({ minConnectSameAirlineMin: v })}
      />
      <Stepper
        label="Switching airlines, at least"
        value={f.minConnectSwitchMin}
        {...LIMITS.minConnectSwitchMin}
        onChange={(v) => set({ minConnectSwitchMin: v })}
      />
      <Stepper
        label="Longest layover"
        value={f.maxLayoverMin}
        {...LIMITS.maxLayoverMin}
        onChange={(v) => set({ maxLayoverMin: v })}
      />
    </View>
  );
}

/**
 * A pill you turn on and off: filled blue when on, the light tint when off, like the rest of the
 * app's buttons (round 139). `wide` makes two to a row, for a pill with a second line.
 */
function TogglePill({
  on,
  label,
  caption,
  leading,
  wide,
  onPress,
  testID,
}: {
  on: boolean;
  label: string;
  caption?: string;
  leading?: ReactNode;
  wide?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const c = useColors();
  const fg = on ? c.onAccent : c.accent;
  return (
    <Pressable
      testID={testID}
      onPress={withTick(onPress)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
      style={pressStyle([styles.pill, wide && styles.pillWide, { backgroundColor: on ? c.accent : c.accentSoft }])}>
      {leading}
      <View style={wide ? styles.flex : undefined}>
        <Text style={[textStyles.bodyStrong, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={[textStyles.small, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Airports a route never connects through (round 174): removable pills plus Add Airport. */
function AvoidAirports({ codes, onChange }: { codes: string[]; onChange: (codes: string[]) => void }) {
  const c = useColors();
  const [picking, setPicking] = useState(false);
  const sheet = useSheetContent(picking ? 'pick' : null);
  return (
    <View style={styles.block}>
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
        Airports to avoid
      </Text>
      <View style={styles.pills} testID="filters-avoid">
        {codes.map((code) => (
          <PillButton
            key={code}
            testID={`filters-avoid-${code}`}
            label={code}
            trailing="xmark"
            fallback="×"
            accessibilityLabel={`Stop avoiding ${AIRPORTS[code]?.name ?? code}`}
            onPress={withTick(() => onChange(codes.filter((x) => x !== code)))}
          />
        ))}
        <PillButton testID="filters-avoid-add" label="Add Airport" leading="plus" fallback="+" onPress={() => setPicking(true)} />
      </View>
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
        No connections there. The airports you search from and to always stay.
      </Text>
      <AirportPicker
        visible={sheet.visible}
        title="Avoid airport"
        exclude={codes}
        onPick={(code) => {
          if (!codes.includes(code)) onChange([...codes, code]);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.section },
  block: { gap: spacing.group },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.group },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: minTapTarget,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.all,
  },
  // Two to a row beside the gap.
  pillWide: { flexBasis: '47%', flexGrow: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    paddingVertical: spacing.rowY,
    borderRadius: radius.all,
  },
  segments: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.all + 4 },
  grid: { flexWrap: 'wrap' },
  // Under half so two fit beside the gap.
  segmentGrid: { flexBasis: '45%' },
  segment: {
    flex: 1,
    minHeight: minTapTarget,
    borderRadius: radius.all,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
