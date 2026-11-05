import { forwardRef, useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
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
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

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
import { FLIP_NUDGE, takeFlipHint } from './flipHint';
import { withTick } from './haptics';
import { useReducedMotion } from './useReducedMotion';
import { pressStyle } from './press';
import { Icon } from './Icon';
import { ResultRow } from './ResultRow';
import { SavedToast } from './SavedToast';
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
  // The route a swipe just saved, for the few seconds its Undo shows (round 138, John).
  const [swipeSaved, setSwipeSaved] = useState<Itinerary | null>(null);
  const clearSwipeSaved = useCallback(() => setSwipeSaved(null), []);
  const [contentH, setContentH] = useState(0);
  const { onRouteHeight } = p;
  useEffect(() => {
    if (!focusedId) {
      setContentH(0);
      setSwipeSaved(null);
    }
  }, [focusedId]);
  useEffect(() => {
    if (focusedId && barH > 0 && contentH > 0) onRouteHeight?.(Math.ceil(barH + contentH));
  }, [focusedId, barH, contentH, onRouteHeight]);
  const { onRouteBarHeight } = p;
  useEffect(() => {
    if (focusedId && barH > 0) onRouteBarHeight?.(Math.ceil(barH));
  }, [focusedId, barH, onRouteBarHeight]);

  // Swipe the route bar left or right to flip routes (round 134, John: the pager "feels forced" in
  // the top right). Runs on every render, so it sits above the loading and error returns.
  const flipRef = useRef<(by: 1 | -1) => void>(() => {});
  const flipPan = usePanGesture({
    runOnJS: true,
    disableReanimated: true,
    activeOffsetX: [-ROUTE_FLIP.start, ROUTE_FLIP.start],
    failOffsetY: [-ROUTE_FLIP.scroll, ROUTE_FLIP.scroll],
    onDeactivate: (e) => {
      const by = routeFlip(e.translationX, e.velocityX, e.canceled);
      if (by) flipRef.current(by);
    },
  });

  // The same swipe on the card itself (round 136, John: hard to know you can swipe). A leftward swipe
  // that starts on the perforation tears the stub instead: that strip's pan starts sooner and wins.
  const cardFlipPan = usePanGesture({
    runOnJS: true,
    disableReanimated: true,
    activeOffsetX: [-ROUTE_FLIP.start, ROUTE_FLIP.start],
    failOffsetY: [-ROUTE_FLIP.scroll, ROUTE_FLIP.scroll],
    onDeactivate: (e) => {
      const by = routeFlip(e.translationX, e.velocityX, e.canceled);
      if (by) flipRef.current(by);
    },
  });
  // The first time a route opens with others beside it, the card slides a little left and back.
  const nudge = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  const canFlip = !!focusedId && results.length > 1;
  useEffect(() => {
    if (!canFlip || reduceMotion) return;
    let alive = true;
    let run: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      takeFlipHint().then((show) => {
        if (!alive || !show) return;
        run = Animated.sequence([
          Animated.timing(nudge, {
            toValue: -FLIP_NUDGE.distance,
            duration: FLIP_NUDGE.out,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(nudge, { toValue: 0, friction: 5, tension: 70, useNativeDriver: true }),
        ]);
        run.start();
      });
    }, FLIP_NUDGE.delay);
    return () => {
      alive = false;
      clearTimeout(timer);
      run?.stop();
      nudge.setValue(0);
    };
  }, [canFlip, reduceMotion, nudge]);

  if (p.state.status === 'loading') {
    return (
      <View style={styles.fill}>
        {topRow}
        <View style={styles.pad}>
          {header}
          <View style={styles.loadingBlock} accessible accessibilityLabel="Finding routes">
            <View style={styles.loading}>
              <ActivityIndicator color={c.muted} />
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
  flipRef.current = (by) => step(focusIndex + by)?.();

  return (
    <View style={styles.fill}>
      {focused ? (
        // A picked route slides in a little from the right, like a push (design round 29).
        <Appear kind="push">
          <View style={styles.fill} testID="route-view">
            {/* One slim row (round 122, John: the market wrapped and the top felt squished): a back
                chevron, the market on one line that shrinks before it would wrap, and a compact pager. */}
            {/* Round 134 (John: the market "still feels odd that it's aligned to the left", and the
                pager "feels forced to have in the top right"): back on the left, the market centered,
                and under it a dot for each route. Swipe the bar left or right, or tap a dot, to flip. */}
            <GestureDetector gesture={flipPan}>
              <View collapsable={false}>
                <CenteredTitleRow
                  style={[styles.bar, styles.pad, styles.routeBar, { borderBottomColor: c.line }]}
                  onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
                  testID="route-bar"
                  left={<BackButton label="" onPress={() => p.onSelect(focused.id)} accessibilityLabel="Back to all routes" />}
                  title={
                    <View style={styles.routeMiddle}>
                      <View
                        ref={routeTitleRef}
                        accessible
                        accessibilityRole="header"
                        accessibilityLabel={focusSpoken}
                        testID="route-title">
                        <RouteEnds from={ends?.from ?? request.origin} to={ends?.to ?? request.destination} />
                      </View>
                      <RouteDots count={results.length} index={focusIndex} onPick={(i) => step(i)?.()} />
                    </View>
                  }
                />
              </View>
            </GestureDetector>
            {/* Flipping to another route fades the card in so the change registers. */}
            <Appear trigger={focused.id}>
              <GestureDetector gesture={cardFlipPan}>
                <Animated.View
                  collapsable={false}
                  style={[styles.fill, { transform: [{ translateX: nudge }] }]}
                  testID="route-card-slide">
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
                    />
                  </ScrollView>
                </Animated.View>
              </GestureDetector>
            </Appear>
            {swipeSaved ? (
              <SavedToast
                key={swipeSaved.id}
                onUndo={() => {
                  if (p.isSaved?.(swipeSaved)) p.onToggleSave?.(swipeSaved);
                }}
                onDone={clearSwipeSaved}
              />
            ) : null}
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
                // Saving lives on the ticket in the list now, not the opened route (round 151, John): the
                // bookmark top right, or a swipe left that tears it along the perforation, with Undo after.
                onSwipeSave={
                  p.onToggleSave && !p.isSaved?.(item)
                    ? () => {
                        p.onToggleSave?.(item);
                        setSwipeSaved(item);
                      }
                    : undefined
                }
                topAction={
                  p.onToggleSave ? (
                    <SaveRouteButton saved={!!p.isSaved?.(item)} onPress={() => p.onToggleSave?.(item)} />
                  ) : undefined
                }
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
        {!focused && swipeSaved ? (
          <SavedToast
            key={swipeSaved.id}
            onUndo={() => {
              if (p.isSaved?.(swipeSaved)) p.onToggleSave?.(swipeSaved);
            }}
            onDone={clearSwipeSaved}
          />
        ) : null}
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
    // Content, not a control, so the same black text and plain pill as the airports in the boxes
    // (round 136, John: "What's with the navy colors").
    <View style={[styles.endPill, { backgroundColor: c.surface2, borderColor: c.line }]} testID="route-end">
      <Text style={[styles.endCode, { color: c.text }]} maxFontSizeMultiplier={1.3}>
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

/** Swiping the route bar: how far or fast before it flips, and how far up or down before it's a scroll. */
export const ROUTE_FLIP = { start: 14, scroll: 12, distance: 44, speed: 450 } as const;

/** Which way a swipe on the route bar flips: +1 to the next route (swipe left), -1 back, 0 for neither. */
export function routeFlip(dx: number, vx: number, canceled = false): 1 | -1 | 0 {
  if (canceled) return 0;
  if (dx <= -ROUTE_FLIP.distance || vx <= -ROUTE_FLIP.speed) return 1;
  if (dx >= ROUTE_FLIP.distance || vx >= ROUTE_FLIP.speed) return -1;
  return 0;
}

/** Up to this many routes get a dot each; past it, the count reads "2 of 24" instead. */
export const MAX_ROUTE_DOTS = 9;

/**
 * Where you are among the routes (round 134): a dot each, the current one a longer pill in the accent,
 * tap a dot to jump. VoiceOver flips by swiping up or down here, as on the old count.
 */
function RouteDots({ count, index, onPick }: { count: number; index: number; onPick: (i: number) => void }) {
  const c = useColors();
  if (count < 2) return null;
  // Small arrows either side say the routes page sideways (round 136, John: "Hard for a user to know
  // they can swipe"); faint at the ends, where there's nothing that way.
  const arrow = (by: 1 | -1) => {
    const to = index + by;
    const on = to >= 0 && to < count;
    return (
      <Pressable
        onPress={on ? () => onPick(to) : undefined}
        disabled={!on}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={pressStyle(styles.pageArrow)}
        testID={by > 0 ? 'route-next' : 'route-prev'}>
        <Icon
          name={by > 0 ? 'chevron.right' : 'chevron.left'}
          size={11}
          weight="semibold"
          tintColor={on ? c.accent : c.line2}
          fallback={<Text style={[textStyles.small, { color: on ? c.accent : c.line2 }]}>{by > 0 ? '›' : '‹'}</Text>}
        />
      </Pressable>
    );
  };
  return (
    <View style={styles.pager} testID="route-pager">
      {arrow(-1)}
      <PagerMarks count={count} index={index} onPick={onPick} />
      {arrow(1)}
    </View>
  );
}

function PagerMarks({ count, index, onPick }: { count: number; index: number; onPick: (i: number) => void }) {
  const c = useColors();
  const a11y = {
    accessible: true,
    accessibilityRole: 'adjustable' as const,
    accessibilityLabel: `Route ${index + 1} of ${count}`,
    accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) =>
      onPick(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)),
    testID: 'route-count',
  };
  if (count > MAX_ROUTE_DOTS) {
    return (
      <Text style={[textStyles.small, styles.count, { color: c.muted }]} numberOfLines={1} {...a11y}>
        {index + 1} of {count}
      </Text>
    );
  }
  return (
    <View style={styles.dots} {...a11y}>
      {Array.from({ length: count }, (_, i) => (
        <Pressable
          key={i}
          onPress={i === index ? undefined : () => onPick(i)}
          hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
          testID="route-dot">
          <View
            style={[styles.dot, i === index ? [styles.dotOn, { backgroundColor: c.accent }] : { backgroundColor: c.line2 }]}
          />
        </Pressable>
      ))}
    </View>
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
      <View style={[styles.rule, { backgroundColor: c.text }]} />
      {/* "Now" and the time set apart by a thin divider, not a dot (rounds 123 and 124, John). */}
      <View style={styles.nowWords}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { fontFamily: fonts.bodySemiBold, color: c.text }]}>
          Now
        </Text>
        {time ? <View style={[styles.nowDivider, { backgroundColor: c.line2 }]} /> : null}
        {time ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { fontFamily: fonts.bodyMedium, color: c.text }]}>
            {time}
          </Text>
        ) : null}
      </View>
      <View style={[styles.rule, { backgroundColor: c.text }]} />
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
  count: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  pad: { paddingHorizontal: spacing.page },
  list: { paddingHorizontal: spacing.page, paddingBottom: spacing.page * 2 },
  header: { gap: 2, paddingTop: spacing.group, paddingBottom: spacing.section },
  headerGap: { height: spacing.group },
  bar: { gap: 4, paddingBottom: spacing.group, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { textAlign: 'center' },
  // The route view's bar (round 134): back on the left, the market and its dots centered.
  routeBar: { paddingTop: 2 },
  routeMiddle: { alignItems: 'center', gap: 6 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 8 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageArrow: { paddingHorizontal: 2, height: 16, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 16 },
  routeEnds: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  endPill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth },
  endCode: { fontFamily: fonts.mono, fontSize: 16, lineHeight: 21, letterSpacing: 0.5 },
  routeEndsTrack: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 64 },
  routeEndsLine: { flex: 1, height: 1 },
  filters: { paddingHorizontal: spacing.section },
  // A little more air between tickets so each one reads as its own (round 150, John).
  sep: { height: spacing.group + 4 },
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
