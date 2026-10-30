import { forwardRef, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AIRPORTS, areaFor, type Flight, type Itinerary, type SearchRequest } from '@/engine';
import type { RouteImpact } from '@/live';
import { shortDate, type DateChip } from '@/search/dates';
import { formatTime } from '@/search/format';
import { departedFirst, type RowStatus } from '@/search/statusTags';
import type { SearchState } from '@/search/useRouteSearch';
import { fonts, radius, spacing, textStyles, useColors } from '@/theme';

import { BackButton } from './BackButton';
import { Button } from './Buttons';
import { DayStepper } from './DayStepper';
import { Icon } from './Icon';
import { ResultRow } from './ResultRow';

export interface ResultsPanelProps {
  state: Exclude<SearchState, { status: 'idle' }>;
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onBack: () => void;
  onRetry: () => void;
  /** Leave-by card for the selected route, shown right under its row. */
  selectedCard?: ReactNode;
  /** Delay/weather impact per itinerary id (item 7). */
  impacts?: Record<string, RouteImpact>;
  impactsLoading?: boolean;
  onImpactPress?: (id: string) => void;
  /** Opens flight status for one leg. */
  onLegPress?: (flight: Flight) => void;
  /** Label shown while impacts are dev sample data. */
  sampleImpacts?: boolean;
  /** Live status tags per itinerary id (Q-050). */
  statuses?: Record<string, RowStatus>;
  /** Label shown while flight statuses are sample data. */
  sampleStatus?: boolean;
  /** Flights are sample data (default true); false once the schedule DB is on. */
  sampleFlights?: boolean;
  /** "Show Them": routes the filters hid, shown for this search only (Q-047). */
  showingHidden?: boolean;
  /** The 0-7 day window; with onDay, the header steps days in place (Q-057). */
  days?: DateChip[];
  onDay?: (date: string) => void;
  /** Opens filters from results (Q-057); the search re-runs when they close. */
  onFilters?: () => void;
  /** How many filters differ from the saved defaults. */
  filtersChanged?: number;
}

export const ResultsPanel = forwardRef<FlatList<Itinerary>, ResultsPanelProps>(function ResultsPanel(p, ref) {
  const c = useColors();
  const { request } = p.state;
  const results = departedFirst(
    p.state.status !== 'done' ? [] : p.showingHidden ? p.state.hiddenResults : p.state.results,
    p.statuses,
  );
  const full = results.filter((r) => r.isFull).length;
  const nowAt = nowLineIndex(results, p.now, p.statuses);
  const stepsDays = !!(p.days && p.onDay);
  // With the day stepper the date is in the stepper, so this line keeps only the count.
  const summary = [
    stepsDays ? null : shortDate(request.date),
    p.state.status === 'done' && results.length
      ? `${results.length} ${results.length === 1 ? 'route' : 'routes'}${full ? `, ${full} full` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Fixed above the list (results take over, Q-062): back, route and Filters on one line,
  // the day and count under it. Sample labels stay in view while you scroll.
  const sampleText = sampleLabel(p.sampleFlights !== false, !!p.sampleImpacts);
  const labels =
    sampleText || p.sampleStatus ? (
      <View style={styles.labels}>
        {sampleText ? <SampleLabel text={sampleText} /> : null}
        {p.sampleStatus ? <SampleLabel text="Sample status" /> : null}
      </View>
    ) : null;
  const topRow = (
    <View style={[styles.bar, styles.pad, { borderBottomColor: c.line }]} testID="results-bar">
      <View style={styles.titleRow}>
        <BackButton label="Search" onPress={p.onBack} accessibilityLabel="Back to search" />
        <Text
          style={[textStyles.heading, styles.title, { color: c.text }]}
          accessibilityRole="header"
          numberOfLines={1}>
          {request.origin} → {request.destination}
        </Text>
        {p.onFilters ? (
          <Button
            label={p.filtersChanged ? `Filters (${p.filtersChanged})` : 'Filters'}
            accessibilityLabel={p.filtersChanged ? `Filters, ${p.filtersChanged} changed` : 'Filters'}
            icon="line.3.horizontal.decrease.circle"
            kind="secondary"
            onPress={p.onFilters}
            style={styles.filters}
          />
        ) : null}
      </View>
      {stepsDays && p.days && p.onDay ? (
        <View style={styles.controls}>
          <DayStepper days={p.days} date={request.date} label={shortDate(request.date)} onDay={p.onDay} />
          <View style={styles.meta}>
            {summary ? (
              <Text style={[textStyles.body, { color: c.muted }]} testID="results-summary">
                {summary}
              </Text>
            ) : null}
            {labels}
          </View>
        </View>
      ) : labels ? (
        <View style={styles.controls}>{labels}</View>
      ) : null}
    </View>
  );

  // Scrolls with the list: notes that matter once.
  const notes = [
    ...(!stepsDays && summary ? [{ key: 'summary', text: summary, testID: 'results-summary', strong: true }] : []),
    ...areaLines(request).map((text) => ({ key: text, text, testID: undefined, strong: false })),
    ...(p.showingHidden
      ? [{ key: 'hidden', text: 'Showing routes your filters hid, for this search only.', testID: undefined, strong: false }]
      : []),
  ];
  const header = notes.length ? (
    <View style={styles.header}>
      {notes.map((n) => (
        <Text key={n.key} testID={n.testID} style={[n.strong ? textStyles.body : textStyles.small, { color: c.muted }]}>
          {n.text}
        </Text>
      ))}
    </View>
  ) : (
    <View style={styles.headerGap} />
  );

  if (p.state.status === 'loading') {
    return (
      <View style={styles.fill}>
        {topRow}
        <View style={styles.pad}>
          {header}
          <View style={[styles.state, styles.loading]} accessible accessibilityLabel="Finding routes">
            <ActivityIndicator color={c.accent} />
            <Text style={[textStyles.body, { color: c.muted }]}>Finding routes…</Text>
          </View>
        </View>
      </View>
    );
  }

  if (p.state.status === 'error') {
    return (
      <View style={styles.fill}>
        {topRow}
        <View style={styles.pad}>
          {header}
          <View style={styles.state}>
            <View style={styles.errorTop} accessible>
              {/* Sample flights load on the phone, so only live data talks about the connection. */}
              <Icon
                name={p.sampleFlights !== false ? 'exclamationmark.triangle' : 'wifi.exclamationmark'}
                size={22}
                tintColor={c.muted}
                fallback={null}
              />
              <View style={styles.errorText}>
                <Text style={[textStyles.heading, { color: c.text }]}>Couldn’t load flights</Text>
                <Text style={[textStyles.body, { color: c.muted }]}>
                  {p.sampleFlights !== false ? 'Something went wrong. Try again.' : 'Check your connection, then try again.'}
                </Text>
              </View>
            </View>
            <Button label="Try Again" onPress={p.onRetry} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {topRow}
      <FlatList
        ref={ref}
        data={results}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item, index }) => {
          const selected = item.id === p.selectedId;
          const row = (
            <ResultRow
              itinerary={item}
              selected={selected}
              now={p.now}
              onPress={p.onSelect}
              impact={p.impacts?.[item.id]}
              impactLoading={p.impactsLoading}
              onImpactPress={p.onImpactPress}
              onLegPress={p.onLegPress}
              status={p.statuses?.[item.id]}
            />
          );
          // The card sits under its own row and scrolls with it, so the half-height sheet
          // still shows the route you picked (it used to sit above the list and push it away).
          const block =
            selected && p.selectedCard ? (
              <View style={styles.selectedBlock} testID="selected-block">
                {row}
                {p.selectedCard}
              </View>
            ) : (
              row
            );
          if (index !== nowAt) return block;
          const tz = AIRPORTS[item.origin]?.tz;
          return (
            <View style={styles.selectedBlock}>
              <NowLine time={tz ? formatTime(p.now, tz) : null} />
              {block}
            </View>
          );
        }}
        onScrollToIndexFailed={() => {}}
        ListFooterComponent={
          <Text style={[textStyles.small, styles.footer, { color: c.muted }]}>
            Follow your airline’s rules on sharing loads.
          </Text>
        }
      />
    </View>
  );
});

/**
 * Says when a side searched its whole area (Q-048), since the title shows only
 * the picked airports: "Leaving from any Dallas airport (DAL, DFW)".
 */
export function areaLines(request: SearchRequest): string[] {
  const line = (code: string, on: boolean | undefined, lead: string) => {
    const area = on ? areaFor(code) : null;
    return area ? `${lead} any ${area.city} airport (${area.airports.join(', ')})` : null;
  };
  return [
    line(request.origin, request.originArea, 'Leaving from'),
    line(request.destination, request.destinationArea, 'Landing at'),
  ].filter((l): l is string => l != null);
}

/**
 * Where the "Now" line goes in departure order: above the first route still
 * to leave, only when routes that already left sit above it (so today only).
 * -1 when there's no line.
 */
export function nowLineIndex(results: Itinerary[], now: number, statuses?: Record<string, RowStatus>): number {
  const i = results.findIndex((it) => it.departUtc >= now && !statuses?.[it.id]?.dimmed);
  return i > 0 ? i : -1;
}

/** Thin rule with "Now · 9:40 PM" (origin time) between routes that left and routes to come. */
function NowLine({ time }: { time: string | null }) {
  const c = useColors();
  return (
    <View
      style={styles.nowLine}
      testID="now-line"
      accessible
      accessibilityLabel={`Now${time ? `, ${time}` : ''}. Flights below haven’t left yet.`}>
      <View style={[styles.rule, { backgroundColor: c.accent }]} />
      <Text style={[textStyles.small, styles.nowText, { color: c.accent }]}>{time ? `Now · ${time}` : 'Now'}</Text>
      <View style={[styles.rule, { backgroundColor: c.accent }]} />
    </View>
  );
}

/** Results label text for what is sample data; null when nothing is. */
export function sampleLabel(flights: boolean, impacts: boolean): string | null {
  if (flights && impacts) return 'Sample flights and delays';
  if (flights) return 'Sample flights';
  return impacts ? 'Sample delays' : null;
}

/** Shown wherever sample data appears, until the schedule DB lands. */
export function SampleLabel({ text = 'Sample flights' }: { text?: string }) {
  const c = useColors();
  return (
    <View style={[styles.sample, { backgroundColor: c.surface2 }]}>
      <Text style={[textStyles.small, { color: c.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  selectedBlock: { gap: spacing.group },
  pad: { paddingHorizontal: spacing.page },
  sample: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  list: { paddingHorizontal: spacing.page, paddingBottom: spacing.page * 2 },
  header: { gap: 2, paddingTop: spacing.group, paddingBottom: spacing.section },
  headerGap: { height: spacing.group },
  bar: { gap: 4, paddingBottom: spacing.group, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, textAlign: 'center' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.group },
  meta: { flexShrink: 1, alignItems: 'flex-end', gap: 2 },
  filters: { paddingHorizontal: spacing.section },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.group },
  sep: { height: spacing.group },
  state: { paddingVertical: spacing.page, gap: spacing.section, alignItems: 'flex-start' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  errorTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.section },
  errorText: { flex: 1, gap: 2 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, flexShrink: 1 },
  footer: { paddingTop: spacing.section },
  nowLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, paddingTop: 2 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  nowText: { fontFamily: fonts.bodySemiBold },
});
