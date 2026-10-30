import { SymbolView } from 'expo-symbols';
import { forwardRef, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import type { Flight, Itinerary } from '@/engine';
import type { RouteImpact } from '@/live';
import { shortDate } from '@/search/dates';
import type { RowStatus } from '@/search/statusTags';
import type { SearchState } from '@/search/useRouteSearch';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { BackButton } from './BackButton';
import { Button } from './Buttons';
import { ResultRow } from './ResultRow';

export interface ResultsPanelProps {
  state: Exclude<SearchState, { status: 'idle' }>;
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onBack: () => void;
  onRetry: () => void;
  /** Leave-by card for the selected route (fixed above the list). */
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
}

export const ResultsPanel = forwardRef<FlatList<Itinerary>, ResultsPanelProps>(function ResultsPanel(p, ref) {
  const c = useColors();
  const { request } = p.state;
  const results = p.state.status !== 'done' ? [] : p.showingHidden ? p.state.hiddenResults : p.state.results;
  const full = results.filter((r) => r.isFull).length;

  // Fixed above the list so the sample-data label never scrolls away.
  const sampleText = sampleLabel(p.sampleFlights !== false, !!p.sampleImpacts);
  const topRow = (
    <View style={[styles.titleRow, styles.pad]}>
      <BackButton label="Search" onPress={p.onBack} accessibilityLabel="Back to search" />
      <View style={styles.labels}>
        {sampleText ? <SampleLabel text={sampleText} /> : null}
        {p.sampleStatus ? <SampleLabel text="Sample status" /> : null}
      </View>
    </View>
  );

  const header = (
    <View style={styles.header}>
      <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
        {request.origin} → {request.destination}
      </Text>
      <Text style={[textStyles.body, { color: c.muted }]}>
        {shortDate(request.date)}
        {p.state.status === 'done' && results.length
          ? ` · ${results.length} ${results.length === 1 ? 'route' : 'routes'}${full ? `, ${full} full` : ''}`
          : ''}
      </Text>
      {p.showingHidden ? (
        <Text style={[textStyles.small, { color: c.muted }]}>Showing routes your filters hid, for this search only.</Text>
      ) : null}
    </View>
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
              <SymbolView
                name="wifi.exclamationmark"
                size={22}
                tintColor={c.muted}
                fallback={null}
              />
              <View style={styles.errorText}>
                <Text style={[textStyles.heading, { color: c.text }]}>Couldn’t load flights</Text>
                <Text style={[textStyles.body, { color: c.muted }]}>Check your connection, then try again.</Text>
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
      {p.selectedCard ? <View style={[styles.pad, styles.card]}>{p.selectedCard}</View> : null}
      <FlatList
        ref={ref}
        data={results}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <ResultRow
            itinerary={item}
            selected={item.id === p.selectedId}
            now={p.now}
            onPress={p.onSelect}
            impact={p.impacts?.[item.id]}
            impactLoading={p.impactsLoading}
            onImpactPress={p.onImpactPress}
            onLegPress={p.onLegPress}
            status={p.statuses?.[item.id]}
          />
        )}
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
  card: { paddingBottom: spacing.group },
  pad: { paddingHorizontal: spacing.page },
  sample: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  list: { paddingHorizontal: spacing.page, paddingBottom: spacing.page * 2 },
  header: { gap: 2, paddingBottom: spacing.section },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sep: { height: spacing.group },
  state: { paddingVertical: spacing.page, gap: spacing.section, alignItems: 'flex-start' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  errorTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.section },
  errorText: { flex: 1, gap: 2 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, flexShrink: 1 },
  footer: { paddingTop: spacing.section },
});
