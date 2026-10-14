import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIRPORTS, addDays, localDate, toRouteLine, type Itinerary } from '@/engine';
import { GlobeMap } from '@/map';
import { dateChips } from '@/search/dates';
import { useRouteSearch } from '@/search/useRouteSearch';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { AirportPicker } from '@/ui/AirportPicker';
import { DEFAULT_FILTERS, FiltersModal, type SearchFilters } from '@/ui/FiltersModal';
import { ResultsPanel } from '@/ui/ResultsPanel';
import { SearchPanel } from '@/ui/SearchPanel';
import { Sheet } from '@/ui/Sheet';

/** Sample-data default route so a search works on first open (no home airport yet; item 9). */
const DEFAULT_ORIGIN = 'BNA';
const DEFAULT_DESTINATION = 'LAX';
/** Peek height above the home indicator. */
const PEEK = 132;
const SHEET = { peek: 0, half: 1, full: 2 } as const;

const airport = (code: string) => AIRPORTS[code];

/**
 * Home: globe behind a bottom sheet holding search, then results.
 * DECISIONS.md: no tabs; top bar = wordmark, Requests pill, Profile.
 */
export default function HomeScreen() {
  const c = useColors();
  const [origin, setOrigin] = useState<string | null>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<string | null>(DEFAULT_DESTINATION);
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [sheetIndex, setSheetIndex] = useState<number>(SHEET.half);
  const listRef = useRef<FlatList<Itinerary>>(null);
  const safe = useSafeAreaInsets();
  const { state, search, reset } = useRouteSearch();

  // 0-7 days out, counted in the origin's local calendar.
  const today = localDate(Date.now(), AIRPORTS[origin ?? DEFAULT_ORIGIN].tz);
  const chips = useMemo(() => dateChips(today), [today]);
  const [date, setDate] = useState(today);
  useEffect(() => {
    if (!chips.some((chip) => chip.date === date)) setDate(today);
  }, [chips, date, today]);

  const snaps = useMemo(() => {
    const h = Math.max(bodyHeight, PEEK * 3);
    return [PEEK + safe.bottom, Math.round(h * 0.48), h - spacing.group];
  }, [bodyHeight, safe.bottom]);

  // Ages ("12m ago") keep counting while results are open.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const results = useMemo(() => (state.status === 'done' ? state.results : []), [state]);
  const routes = useMemo(() => results.map((it) => toRouteLine(it, airport)), [results]);

  const runSearch = useCallback(
    (d = date) => {
      if (!origin || !destination) return;
      setSelectedId(null);
      setSheetIndex(SHEET.half);
      search({ origin, destination, date: d }, filters);
    },
    [origin, destination, date, filters, search],
  );

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const index = results.findIndex((r) => r.id === id);
      if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.2 });
      setSheetIndex((i) => (i === SHEET.full ? SHEET.half : i));
    },
    [results],
  );

  const onBodyLayout = (e: LayoutChangeEvent) => setBodyHeight(e.nativeEvent.layout.height);
  const filtersChanged = (Object.keys(DEFAULT_FILTERS) as (keyof SearchFilters)[]).filter(
    (k) => filters[k] !== DEFAULT_FILTERS[k],
  ).length;
  const lastChip = chips[chips.length - 1].date;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={[textStyles.wordmark, { color: c.text }]} accessibilityRole="header">
          OutBound
        </Text>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Requests"
            style={[styles.pill, { backgroundColor: c.accentSoft }]}>
            <Text style={[textStyles.bodyStrong, { color: c.accent }]}>Requests</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            style={[styles.pill, { backgroundColor: c.surface2 }]}>
            <Text style={[textStyles.bodyStrong, { color: c.text }]}>Profile</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body} onLayout={onBodyLayout}>
        <GlobeMap
          routes={routes}
          selectedRouteId={selectedId}
          onSelectRoute={select}
          insets={{ bottom: snaps[sheetIndex] }}
        />
        {bodyHeight > 0 ? (
          <Sheet snaps={snaps} index={sheetIndex} onIndexChange={setSheetIndex}>
            {state.status === 'idle' ? (
              <SearchPanel
                chips={chips}
                date={date}
                onDate={setDate}
                origin={origin}
                destination={destination}
                onPickOrigin={() => setPicking('origin')}
                onPickDestination={() => setPicking('destination')}
                onSwap={() => {
                  setOrigin(destination);
                  setDestination(origin);
                }}
                onFilters={() => setFiltersOpen(true)}
                filtersChanged={filtersChanged}
                onFind={() => runSearch()}
              />
            ) : (
              <ResultsPanel
                ref={listRef}
                state={state}
                selectedId={selectedId}
                now={now}
                onSelect={(id) => select(id === selectedId ? null : id)}
                onBack={() => {
                  setSelectedId(null);
                  reset();
                }}
                onRetry={() => runSearch(state.request.date)}
                onLoosen={() => setFiltersOpen(true)}
                onTomorrow={
                  state.request.date < lastChip
                    ? () => {
                        const next = addDays(state.request.date, 1);
                        setDate(next);
                        runSearch(next);
                      }
                    : null
                }
              />
            )}
          </Sheet>
        ) : null}
      </View>

      <AirportPicker
        visible={picking !== null}
        title={picking === 'origin' ? 'From' : 'To'}
        onPick={(code) => {
          if (picking === 'origin') setOrigin(code);
          else setDestination(code);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <FiltersModal
        visible={filtersOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => {
          setFiltersOpen(false);
          if (state.status !== 'idle') runSearch(state.request.date);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    minHeight: minTapTarget,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.group,
  },
  pill: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});
