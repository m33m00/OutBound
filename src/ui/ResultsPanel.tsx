import { forwardRef, useCallback, useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AIRPORTS, areaFor, type Flight, type Itinerary, type SearchRequest } from '@/engine';
import type { RouteImpact } from '@/live';
import { shortDate, type DateChip } from '@/search/dates';
import { formatTime } from '@/search/format';
import { departedFirst, type RowStatus } from '@/search/statusTags';
import type { SearchState } from '@/search/useRouteSearch';
import { fonts, radius, spacing, textStyles, useColors } from '@/theme';

import { Appear } from './Appear';
import { BackButton } from './BackButton';
import { Button } from './Buttons';
import { DayStepper } from './DayStepper';
import { withTick } from './haptics';
import { pressStyle } from './press';
import { Icon } from './Icon';
import { ResultRow } from './ResultRow';
import { SaveRouteButton } from './SaveRouteButton';

export interface ResultsPanelProps {
  state: Exclude<SearchState, { status: 'idle' }>;
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onBack: () => void;
  onRetry: () => void;
  /** Leave-by card for the selected route, shown at the top of its route view (John, 2026-10-30). */
  selectedCard?: ReactNode;
  /** Delay/weather impact per itinerary id (item 7). */
  impacts?: Record<string, RouteImpact>;
  impactsLoading?: boolean;
  onImpactPress?: (id: string) => void;
  /** Opens flight status for one leg. */
  onLegPress?: (flight: Flight) => void;
  /** Live status tags per itinerary id (Q-050). */
  statuses?: Record<string, RowStatus>;
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
  /** Whether a route is in My Trips (Q-043); with onToggleSave the route view shows Save Route. */
  isSaved?: (it: Itinerary) => boolean;
  onToggleSave?: (it: Itinerary) => void;
  /** One more line under the count, e.g. a saved route that's no longer in the results. */
  note?: string;
}

export const ResultsPanel = forwardRef<FlatList<Itinerary>, ResultsPanelProps>(function ResultsPanel(p, ref) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  // At big text sizes Back and Filters shrink to their icons so the route title keeps room.
  const tight = fontScale >= COMPACT_BAR_SCALE;
  const { request } = p.state;
  const routeTitle = `${request.origin} → ${request.destination}`;
  const routeSpoken = `${request.origin} to ${request.destination}`;
  const results = departedFirst(
    p.state.status !== 'done' ? [] : p.showingHidden ? p.state.hiddenResults : p.state.results,
    p.statuses,
  );
  const full = results.filter((r) => r.isFull).length;
  const nowAt = nowLineIndex(results, p.now, p.statuses);

  // Today's list opens at the "Now" line (Q-066, John 2026-10-30): routes that already
  // left stay above it, a short scroll up. Once you scroll yourself it leaves you be.
  const listRef = useRef<FlatList<Itinerary> | null>(null);
  const setListRef = useCallback(
    (node: FlatList<Itinerary> | null) => {
      listRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const searchKey = p.state.status === 'done' ? `${p.state.searchedAt}:${!!p.showingHidden}` : null;
  const userScrolled = useRef(false);
  useEffect(() => {
    userScrolled.current = false;
  }, [searchKey]);
  // Picking a route counts too: coming back should land on that route, not the Now line.
  useEffect(() => {
    if (p.selectedId) userScrolled.current = true;
  }, [p.selectedId]);
  useEffect(() => {
    if (searchKey == null || nowAt <= 0 || userScrolled.current) return;
    const frame = requestAnimationFrame(() =>
      listRef.current?.scrollToIndex({ index: nowAt, viewPosition: 0, animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [searchKey, nowAt]);
  // VoiceOver follows the panel (design round 29): opening or flipping a route lands on its
  // title, and coming back lands on the list's title, instead of staying on a button that's gone.
  const routeTitleRef = useRef<ComponentRef<typeof Text>>(null);
  const listTitleRef = useRef<ComponentRef<typeof Text>>(null);
  const shownRoute = p.state.status === 'done' ? p.selectedId : null;
  const lastRoute = useRef(shownRoute);
  useEffect(() => {
    const was = lastRoute.current;
    lastRoute.current = shownRoute;
    if (was === shownRoute) return;
    const target = shownRoute ? routeTitleRef : was ? listTitleRef : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      if (target.current) AccessibilityInfo.sendAccessibilityEvent(target.current, 'focus');
    });
    return () => cancelAnimationFrame(frame);
  }, [shownRoute]);
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
  // the day and count under it.
  const topRow = (
    <View style={[styles.bar, styles.pad, { borderBottomColor: c.line }]} testID="results-bar">
      <View style={styles.titleRow}>
        <BackButton label={tight ? '' : 'Search'} onPress={p.onBack} accessibilityLabel="Back to search" />
        <Text
          ref={listTitleRef}
          style={[textStyles.heading, styles.title, { color: c.text }]}
          accessibilityRole="header"
          accessibilityLabel={routeSpoken}
          numberOfLines={2}>
          {routeTitle}
        </Text>
        {p.onFilters ? (
          <Button
            label={tight ? (p.filtersChanged ? String(p.filtersChanged) : '') : p.filtersChanged ? `Filters (${p.filtersChanged})` : 'Filters'}
            accessibilityLabel={p.filtersChanged ? `Filters, ${p.filtersChanged} changed` : 'Filters'}
            icon="line.3.horizontal.decrease.circle"
            kind="secondary"
            onPress={p.onFilters}
            style={styles.filters}
          />
        ) : null}
      </View>
      {stepsDays && p.days && p.onDay ? (
        // Full width: arrows at the panel edges, the day and route count centered (John, 2026-10-30).
        <DayStepper
          days={p.days}
          date={request.date}
          label={shortDate(request.date)}
          onDay={p.onDay}
          detail={summary || undefined}
        />
      ) : null}
    </View>
  );

  // Scrolls with the list: notes that matter once.
  const notes = [
    ...(!stepsDays && summary ? [{ key: 'summary', text: summary, testID: 'results-summary', strong: true }] : []),
    ...areaLines(request).map((text) => ({ key: text, text, testID: undefined, strong: false })),
    ...(p.note ? [{ key: 'note', text: p.note, testID: 'results-note', strong: false }] : []),
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

  // A picked route gets its own view (John, 2026-10-30): leave-by on top, then the route
  // card in larger type. The list stays mounted underneath so it keeps its scroll spot.
  const focusIndex = p.selectedId ? results.findIndex((r) => r.id === p.selectedId) : -1;
  const focused = focusIndex >= 0 ? results[focusIndex] : undefined;
  const step = (to: number) => {
    const target = results[to];
    return target ? withTick(() => p.onSelect(target.id)) : undefined;
  };

  return (
    <View style={styles.fill}>
      {focused ? (
        // A picked route slides in a little from the right, like a push (design round 29).
        <Appear kind="push">
          <View style={styles.fill} testID="route-view">
            <View style={[styles.bar, styles.pad, styles.titleRow, { borderBottomColor: c.line }]}>
              <BackButton
                label={tight ? '' : 'Routes'}
                onPress={() => p.onSelect(focused.id)}
                accessibilityLabel="Back to all routes"
              />
              <Text
                ref={routeTitleRef}
                style={[textStyles.heading, styles.title, { color: c.text }]}
                accessibilityRole="header"
                accessibilityLabel={routeSpoken}
                numberOfLines={2}>
                {routeTitle}
              </Text>
              {p.onToggleSave ? (
                <SaveRouteButton saved={!!p.isSaved?.(focused)} onPress={() => p.onToggleSave?.(focused)} />
              ) : null}
              <View style={styles.pager}>
                <StepArrow dir="prev" onPress={step(focusIndex - 1)} />
                {/* VoiceOver: swipe up or down here to flip routes (the arrows stay for Voice Control). */}
                <Text
                  style={[textStyles.body, { color: c.muted }]}
                  testID="route-count"
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={`Route ${focusIndex + 1} of ${results.length}`}
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                  onAccessibilityAction={(e) => step(focusIndex + (e.nativeEvent.actionName === 'increment' ? 1 : -1))?.()}>
                  {focusIndex + 1} of {results.length}
                </Text>
                <StepArrow dir="next" onPress={step(focusIndex + 1)} />
              </View>
            </View>
            {/* Flipping to another route fades the card in so the change registers. */}
            <Appear trigger={focused.id}>
              {/* Keyed by route so each one opens at its top. */}
              <ScrollView key={focused.id} contentContainerStyle={styles.focus}>
                {/* Keyed by route so paging re-announces the new Leave By time. */}
                {p.selectedCard ? (
                  <View testID="selected-card" key={focused.id}>
                    {p.selectedCard}
                  </View>
                ) : null}
                <ResultRow
                  itinerary={focused}
                  selected
                  large
                  now={p.now}
                  onPress={p.onSelect}
                  impact={p.impacts?.[focused.id]}
                  impactLoading={p.impactsLoading}
                  onImpactPress={p.onImpactPress}
                  onLegPress={p.onLegPress}
                  status={p.statuses?.[focused.id]}
                />
              </ScrollView>
            </Appear>
          </View>
        </Appear>
      ) : null}
      {/* Back from a route, the list fades back in where you left it. */}
      <Appear trigger={!focused} style={focused && styles.hidden}>
        {topRow}
        <FlatList
          ref={setListRef}
          data={results}
          onScrollBeginDrag={() => {
            userScrolled.current = true;
          }}
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
                saved={p.isSaved?.(item)}
              />
            );
            const block = row;
            if (index !== nowAt) return block;
            const tz = AIRPORTS[item.origin]?.tz;
            return (
              <View style={styles.selectedBlock}>
                <NowLine time={tz ? formatTime(p.now, tz) : null} />
                {block}
              </View>
            );
          }}
          // Rows aren't measured yet: jump near the row by its average height instead.
          onScrollToIndexFailed={(info) =>
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })
          }
          ListFooterComponent={
            <Text style={[textStyles.small, styles.footer, { color: c.muted }]}>
              Follow your airline’s rules on sharing loads.
            </Text>
          }
        />
      </Appear>
    </View>
  );
});

/** Text size at which the results bar shows Back and Filters as icons only. */
export const COMPACT_BAR_SCALE = 1.3;

/** Previous / next route in the route view; dims at the ends of the list. */
function StepArrow({ dir, onPress }: { dir: 'prev' | 'next'; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      testID={`route-${dir}`}
      onPress={onPress}
      hitSlop={{ left: 4, right: 4 }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Previous route' : 'Next route'}
      accessibilityState={{ disabled: !onPress }}
      style={pressStyle([styles.stepArrow, { opacity: onPress ? 1 : 0.35 }])}>
      <Icon
        name={dir === 'prev' ? 'chevron.left' : 'chevron.right'}
        size={16}
        weight="semibold"
        tintColor={c.accent}
        fallback={<Text style={[textStyles.heading, { color: c.accent }]}>{dir === 'prev' ? '‹' : '›'}</Text>}
      />
    </Pressable>
  );
}

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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  selectedBlock: { gap: spacing.group },
  hidden: { display: 'none' },
  focus: { padding: spacing.page, paddingTop: spacing.section, gap: spacing.section },
  pager: { flexDirection: 'row', alignItems: 'center' },
  stepArrow: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: spacing.page },
  list: { paddingHorizontal: spacing.page, paddingBottom: spacing.page * 2 },
  header: { gap: 2, paddingTop: spacing.group, paddingBottom: spacing.section },
  headerGap: { height: spacing.group },
  bar: { gap: 4, paddingBottom: spacing.group, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, textAlign: 'center' },
  filters: { paddingHorizontal: spacing.section },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.group },
  sep: { height: spacing.group },
  state: { paddingVertical: spacing.page, gap: spacing.section, alignItems: 'flex-start' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  errorTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.section },
  errorText: { flex: 1, gap: 2 },
  footer: { paddingTop: spacing.section },
  nowLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, paddingTop: 2 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  nowText: { fontFamily: fonts.bodySemiBold },
});
