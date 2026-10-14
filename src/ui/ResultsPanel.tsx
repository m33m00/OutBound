import { forwardRef, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Itinerary } from '@/engine';
import type { RouteImpact } from '@/live';
import { shortDate } from '@/search/dates';
import type { SearchState } from '@/search/useRouteSearch';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { ResultRow } from './ResultRow';

export interface ResultsPanelProps {
  state: Exclude<SearchState, { status: 'idle' }>;
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onBack: () => void;
  onRetry: () => void;
  onLoosen: () => void;
  /** Null when tomorrow is past the 0-7 day window. */
  onTomorrow: (() => void) | null;
  /** Leave-by card for the selected route (fixed above the list). */
  selectedCard?: ReactNode;
  /** Delay/weather impact per itinerary id (item 7). */
  impacts?: Record<string, RouteImpact>;
  impactsLoading?: boolean;
  onImpactPress?: (id: string) => void;
  /** Label shown while impacts are dev sample data. */
  sampleImpacts?: boolean;
}

export const ResultsPanel = forwardRef<FlatList<Itinerary>, ResultsPanelProps>(function ResultsPanel(p, ref) {
  const c = useColors();
  const { request } = p.state;
  const results = p.state.status === 'done' ? p.state.results : [];
  const full = results.filter((r) => r.isFull).length;

  // Fixed above the list so the sample-data label never scrolls away.
  const topRow = (
    <View style={[styles.titleRow, styles.pad]}>
      <Pressable
        onPress={p.onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to search"
        style={styles.back}>
        <Text style={[textStyles.heading, { color: c.accent }]}>‹ Search</Text>
      </Pressable>
      <SampleLabel text={p.sampleImpacts ? 'Sample flights and delays' : undefined} />
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
    </View>
  );

  if (p.state.status === 'loading') {
    return (
      <View style={styles.fill}>
        {topRow}
        <View style={styles.pad}>
          {header}
          <ActivityIndicator accessibilityLabel="Finding routes" color={c.accent} style={styles.state} />
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
            <Text style={[textStyles.body, { color: c.text }]}>Couldn’t load flights.</Text>
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
          />
        )}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={
          <View style={styles.state}>
            <Text style={[textStyles.body, { color: c.text }]}>No routes found for this day.</Text>
            <View style={styles.emptyActions}>
              <Button label="Loosen Filters" kind="secondary" onPress={p.onLoosen} />
              {p.onTomorrow ? <Button label="Search Tomorrow" onPress={p.onTomorrow} /> : null}
            </View>
          </View>
        }
        ListFooterComponent={
          <Text style={[textStyles.small, styles.footer, { color: c.muted }]}>
            Follow your airline’s rules on sharing loads.
          </Text>
        }
      />
    </View>
  );
});

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
  back: { minHeight: minTapTarget, justifyContent: 'center', paddingRight: spacing.page },
  sep: { height: spacing.group },
  state: { paddingVertical: spacing.page, gap: spacing.section, alignItems: 'flex-start' },
  emptyActions: { flexDirection: 'row', gap: spacing.group },
  footer: { paddingTop: spacing.section },
});
