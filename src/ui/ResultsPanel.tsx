import { forwardRef, useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AIRPORTS, areaFor, localDate, type Flight, type Itinerary, type SearchRequest } from '@/engine';
import type { RouteImpact } from '@/live';
import { shortDate, type DateChip } from '@/search/dates';
import { formatTime } from '@/search/format';
import { departedFirst, type RowStatus } from '@/search/statusTags';
import type { SearchState } from '@/search/useRouteSearch';
import { fonts, radius, spacing, textStyles, useColors } from '@/theme';

import { Appear } from './Appear';
import { BackButton } from './BackButton';
import { CenteredTitleRow } from './CenteredTitleRow';
import { Button } from './Buttons';
import { DayStepper } from './DayStepper';
import { withTick } from './haptics';
import { pressStyle } from './press';
import { Icon } from './Icon';
import { ResultRow } from './ResultRow';
import { SaveRouteButton } from './SaveRouteButton';
import { StaggerIn } from './StaggerIn';

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
  /** Height the open route needs (title bar plus everything under it), so the panel can fit it without scrolling (round 56). */
  onRouteHeight?: (height: number) => void;
  /** Height of the open route's title bar, so the collapsed panel shows exactly that row (round 90). */
  onRouteBarHeight?: (height: number) => void;
  /** A hard pull down on the route or list while it's at its top: the panel steps down a size (round 58). */
  onPullDown?: () => void;
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
  // The Now line is for today's flights only (John, 2026-11-02), by the origin's own date.
  const originTz = AIRPORTS[results[0]?.legs[0]?.flight.from ?? '']?.tz ?? AIRPORTS[request.origin]?.tz;
  const onToday = !originTz || localDate(p.now, originTz) === request.date;
  const nowAt = onToday ? nowLineIndex(results, p.now, p.statuses) : -1;

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
  const retries = useRef(0);
  // When this list first showed: rows that mount soon after rise in; later ones just appear.
  const listShownAt = useRef(Date.now());
  useEffect(() => {
    userScrolled.current = false;
    listShownAt.current = Date.now();
  }, [searchKey]);
  // An open route holds the list still; coming back lands on the Now line at the top again
  // (John, 2026-11-02: "it shows the flights above the now line").
  const wasOpen = useRef(false);
  useEffect(() => {
    if (p.selectedId) {
      userScrolled.current = true;
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      userScrolled.current = false;
      retries.current = 0;
    }
  }, [p.selectedId]);
  // The list opens with the Now line at the top (John, 2026-11-02: "I shouldn't see the flights
  // before that"); routes that left are a scroll up. Rows measure in over a few frames and the
  // panel grows to full screen, so it pins again on every layout change until you scroll.
  const pinNow = useCallback(() => {
    if (searchKey == null || nowAt <= 0 || userScrolled.current) return;
    listRef.current?.scrollToIndex({ index: nowAt, viewPosition: 0, animated: false });
  }, [searchKey, nowAt]);
  useEffect(() => {
    retries.current = 0;
    const frame = requestAnimationFrame(pinNow);
    return () => cancelAnimationFrame(frame);
  }, [pinNow, p.selectedId]);
  // VoiceOver follows the panel (design round 29): opening or flipping a route lands on its
  // title, and coming back lands on the list's title, instead of staying on a button that's gone.
  const routeTitleRef = useRef<ComponentRef<typeof View>>(null);
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
    // Stacked, not dotted (round 123, John: no dots between text).
    .join('\n');

  // Fixed above the list (results take over, Q-062): back, route and Filters on one line,
  // the day and count under it.
  const topRow = (
    <View style={[styles.bar, styles.pad, { borderBottomColor: c.line }]} testID="results-bar">
      <CenteredTitleRow
        left={<BackButton label={tight ? '' : 'Search'} onPress={p.onBack} accessibilityLabel="Back to search" />}
        title={
          <Text
            ref={listTitleRef}
            style={[textStyles.routeTitle, styles.title, { color: c.text }]}
            accessibilityRole="header"
            accessibilityLabel={routeSpoken}
            numberOfLines={2}>
            {softArrows(routeTitle, c.faint)}
          </Text>
        }
        right={
          p.onFilters ? (
            <Button
              label={
                tight
                  ? p.filtersChanged
                    ? String(p.filtersChanged)
                    : ''
                  : p.filtersChanged
                    ? `Filters (${p.filtersChanged})`
                    : 'Filters'
              }
              accessibilityLabel={p.filtersChanged ? `Filters, ${p.filtersChanged} changed` : 'Filters'}
              icon="line.3.horizontal.decrease.circle"
              kind="secondary"
              onPress={p.onFilters}
              style={styles.filters}
            />
          ) : null
        }
      />
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

  // A picked route gets its own view (John, 2026-10-30); found here, above the loading and
  // error returns, so the hooks below run on every render.
  const focusIndex = p.selectedId ? results.findIndex((r) => r.id === p.selectedId) : -1;
  const focused = focusIndex >= 0 ? results[focusIndex] : undefined;
  const focusedId = focused?.id;
  // A picked route is titled by its own airports: a DAL/DFW search that flies from DFW reads
  // "DFW → LAX", matching the flight boxes and the globe (round 90).
  const ends = focused ? routeEnds(focused) : null;
  const focusTitle = ends ? `${ends.from} → ${ends.to}` : routeTitle;
  const focusSpoken = ends ? `${ends.from} to ${ends.to}` : routeSpoken;
  // The open route's bar and content heights, reported together once both are known (round 56).
  // Content starts over when the route view closes, so a reopened route reports its own height.
  const [barH, setBarH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const { onRouteHeight } = p;
  useEffect(() => {
    if (!focusedId) setContentH(0);
  }, [focusedId]);
  useEffect(() => {
    if (focusedId && barH > 0 && contentH > 0) onRouteHeight?.(Math.ceil(barH + contentH));
  }, [focusedId, barH, contentH, onRouteHeight]);
  const { onRouteBarHeight } = p;
  useEffect(() => {
    if (focusedId && barH > 0) onRouteBarHeight?.(Math.ceil(barH));
  }, [focusedId, barH, onRouteBarHeight]);

  if (p.state.status === 'loading') {
    return (
      <View style={styles.fill}>
        {topRow}
        <View style={styles.pad}>
          {header}
          <View style={styles.loadingBlock} accessible accessibilityLabel="Finding routes">
            <View style={styles.loading}>
              <ActivityIndicator color={c.accent} />
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>
                Finding routes…
              </Text>
            </View>
            {/* Row-shaped placeholders so the panel isn't empty while it loads; static, so Reduce Motion needs nothing (round 54). */}
            {[0, 1, 2, 3].map((i) => (
              <PlaceholderRow key={i} />
            ))}
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
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
                  Couldn’t load flights
                </Text>
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>
                  {p.sampleFlights !== false
                    ? 'Your search is still set. Try again in a moment.'
                    : 'Check your connection, then try again. Your search is still set.'}
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
  // Pulling hard past the top of the route or list moves the panel itself, so you
  // don't have to reach for the handle (John, 2026-10-30).
  const pullDown = p.onPullDown
    ? (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isHardPullDown(e.nativeEvent)) p.onPullDown?.();
      }
    : undefined;
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
            {/* One slim row (round 122, John: the market wrapped and the top felt squished): a back
                chevron, the market on one line that shrinks before it would wrap, and a compact pager. */}
            <View
              style={[styles.bar, styles.pad, styles.routeBar, { borderBottomColor: c.line }]}
              onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
              testID="route-bar">
              <BackButton label="" onPress={() => p.onSelect(focused.id)} accessibilityLabel="Back to all routes" />
              {/* The market as two airport pills with a plane between, not a line of text (round 132,
                  John: "Same with displaying the mark at the top of the card next to the page selector"). */}
              <View
                ref={routeTitleRef}
                style={styles.routeTitle}
                accessible
                accessibilityRole="header"
                accessibilityLabel={focusSpoken}
                testID="route-title">
                <RouteEnds from={ends?.from ?? request.origin} to={ends?.to ?? request.destination} />
              </View>
              <View style={styles.pager}>
                <StepArrow dir="prev" onPress={step(focusIndex - 1)} />
                {/* VoiceOver: swipe up or down here to flip routes (the arrows stay for Voice Control). */}
                <Text
                  style={[textStyles.small, styles.count, { color: c.muted }]}
                  numberOfLines={1}
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
              <ScrollView
                key={focused.id}
                // The pass sits on the page color, so its torn edge reads as cut out (round 114).
                style={{ backgroundColor: c.bg }}
                contentContainerStyle={styles.focus}
                onScrollEndDrag={pullDown}
                onContentSizeChange={(_, h) => setContentH(h)}>
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
                  onSwipeSave={p.onToggleSave && !p.isSaved?.(focused) ? () => p.onToggleSave?.(focused) : undefined}
                  topAction={
                    p.onToggleSave ? (
                      <SaveRouteButton saved={!!p.isSaved?.(focused)} onPress={() => p.onToggleSave?.(focused)} />
                    ) : undefined
                  }
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
          // White cards on the page color, like passes on a counter (round 114).
          style={{ backgroundColor: c.bg }}
          onScrollBeginDrag={() => {
            userScrolled.current = true;
          }}
          onContentSizeChange={pinNow}
          onLayout={pinNow}
          onScrollEndDrag={pullDown}
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
            // A fresh list's rows rise in one after another from the top of what you see (round 113).
            const block = (
              <StaggerIn step={index - Math.max(0, nowAt)} play={Date.now() - listShownAt.current < STAGGER_WINDOW_MS}>
                {row}
              </StaggerIn>
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
          // Rows aren't measured yet: jump near the row by its average height, then try again once
          // they are (a few times at most).
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            if (retries.current < 5) {
              retries.current += 1;
              setTimeout(pinNow, 50);
            }
          }}
          ListFooterComponent={
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.footer, { color: c.muted }]}>
              Follow your airline’s rules on sharing loads.
            </Text>
          }
        />
      </Appear>
    </View>
  );
});

/** Overscroll (pt) past the top that counts as pulling the panel down. */
export const PULL_DOWN_OVERSCROLL = 50;
/** Downward flick speed (pt/ms) at the top that counts as pulling the panel down. */
export const PULL_DOWN_VELOCITY = 1;

/**
 * A hard pull down at the top of a list: dragged well past the top (iOS bounce), or
 * flicked down fast while already at the top. A pull further down the list just scrolls.
 */
/** The route bar's market: two airport pills joined by a short line with a plane (round 132). */
function RouteEnds({ from, to }: { from: string; to: string }) {
  const c = useColors();
  const pill = (code: string) => (
    <View style={[styles.endPill, { backgroundColor: c.accentSoft }]} testID="route-end">
      <Text style={[styles.endCode, { color: c.accent }]} maxFontSizeMultiplier={1.3}>
        {code}
      </Text>
    </View>
  );
  return (
    <View style={styles.routeEnds}>
      {pill(from)}
      <View style={styles.routeEndsTrack}>
        <View style={[styles.routeEndsLine, { backgroundColor: c.line2 }]} />
        <Icon name="airplane" size={12} tintColor={c.faint} fallback={<Text style={{ color: c.faint }}>✈</Text>} />
        <View style={[styles.routeEndsLine, { backgroundColor: c.line2 }]} />
      </View>
      {pill(to)}
    </View>
  );
}

/** "DFW → LGA" with soft grey arrows so the codes lead (round 120, the Clean look). */
function softArrows(title: string, accent: string) {
  return title.split(' → ').flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <Text key={`a${i}`} style={{ color: accent }}>
            {' → '}
          </Text>,
          part,
        ],
  );
}

export function isHardPullDown(e: Pick<NativeScrollEvent, 'contentOffset'> & { velocity?: { x: number; y: number } }): boolean {
  const y = e.contentOffset.y;
  return y <= -PULL_DOWN_OVERSCROLL || (y <= 0 && (e.velocity?.y ?? 0) <= -PULL_DOWN_VELOCITY);
}

/** Text size at which the results bar shows Back and Filters as icons only. */
export const COMPACT_BAR_SCALE = 1.3;

/** Previous / next route in the route view; dims at the ends of the list. */
function StepArrow({ dir, onPress }: { dir: 'prev' | 'next'; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      testID={`route-${dir}`}
      onPress={onPress}
      hitSlop={{ left: 6, right: 6, top: 8, bottom: 8 }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Previous route' : 'Next route'}
      accessibilityState={{ disabled: !onPress }}
      style={pressStyle([styles.stepArrow, { backgroundColor: c.accentSoft, opacity: onPress ? 1 : 0.35 }])}>
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
/** How long after a list shows its rows still rise in. */
const STAGGER_WINDOW_MS = 900;

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
      {/* "Now" and the time set apart by a thin divider, not a dot (rounds 123 and 124, John). */}
      <View style={styles.nowWords}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { fontFamily: fonts.bodySemiBold, color: c.accent }]}>
          Now
        </Text>
        {time ? <View style={[styles.nowDivider, { backgroundColor: c.accent }]} /> : null}
        {time ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { fontFamily: fonts.bodyMedium, color: c.accent }]}>
            {time}
          </Text>
        ) : null}
      </View>
      <View style={[styles.rule, { backgroundColor: c.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  nowWords: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // A thin divider between Now and the time (round 124, John: "Needs dividers").
  nowDivider: { width: 1, height: 11, opacity: 0.45 },
  selectedBlock: { gap: spacing.group },
  hidden: { display: 'none' },
  // Tighter above and between the Leave By card and the route card so the whole route fits (round 122).
  focus: { padding: spacing.page, paddingTop: spacing.group + 2, gap: spacing.group + 2 },
  // Room between the arrows and the count so nothing touches (John, 2026-11-01).
  pager: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  count: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  // Round soft buttons (round 79), so flipping routes reads as a button, not a bare chevron.
  stepArrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: spacing.page },
  list: { paddingHorizontal: spacing.page, paddingBottom: spacing.page * 2 },
  header: { gap: 2, paddingTop: spacing.group, paddingBottom: spacing.section },
  headerGap: { height: spacing.group },
  bar: { gap: 4, paddingBottom: spacing.group, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { textAlign: 'center' },
  // The route view's bar: back, the market on the left taking the room, the pager at the end.
  routeBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, paddingTop: 2 },
  routeTitle: { flex: 1, minWidth: 0 },
  routeEnds: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  endPill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  endCode: { fontFamily: fonts.mono, fontSize: 16, lineHeight: 21, letterSpacing: 0.5 },
  routeEndsTrack: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 64 },
  routeEndsLine: { flex: 1, height: 1 },
  filters: { paddingHorizontal: spacing.section },
  sep: { height: spacing.group },
  state: { paddingVertical: spacing.page, gap: spacing.section, alignItems: 'flex-start' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  loadingBlock: { paddingVertical: spacing.section, gap: spacing.group },
  placeholder: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.rowY,
    paddingHorizontal: spacing.rowX,
    gap: spacing.group,
  },
  placeholderLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.group },
  placeholderBar: { borderRadius: 4 },
  errorTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.section },
  errorText: { flex: 1, gap: 2 },
  footer: { paddingTop: spacing.section },
  nowLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, paddingTop: 2 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});

/** A slim result row's shape (times, seat chip; route; airline pills) in gray, while routes load. */
function PlaceholderRow() {
  const c = useColors();
  // line2, not surface2: surface2 barely shows on a card in dark mode.
  const fill = { backgroundColor: c.line2 };
  return (
    <View style={[styles.placeholder, { backgroundColor: c.surface, borderColor: c.line }]} testID="placeholder-row">
      <View style={styles.placeholderLine}>
        <View style={[styles.placeholderBar, fill, { width: '46%', height: 16 }]} />
        <View style={[styles.placeholderBar, fill, { width: 64, height: 18 }]} />
      </View>
      <View style={[styles.placeholderBar, fill, { width: '38%', height: 12 }]} />
      <View style={styles.placeholderLine}>
        <View style={[styles.placeholderBar, fill, { width: 40, height: 16 }]} />
      </View>
    </View>
  );
}

/** First departure and last arrival airports of a route. */
export function routeEnds(it: {
  legs: readonly { flight: { from: string; to: string } }[];
}): { from: string; to: string } | null {
  if (it.legs.length === 0) return null;
  return { from: it.legs[0].flight.from, to: it.legs[it.legs.length - 1].flight.to };
}
