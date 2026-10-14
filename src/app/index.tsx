import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIRPORTS, addDays, localDate, toRouteLine, type Itinerary } from '@/engine';
import { sampleRouteImpacts, useRouteImpacts } from '@/live';
import { GlobeMap, type MapAirport } from '@/map';
import { dateChips } from '@/search/dates';
import { useRouteSearch } from '@/search/useRouteSearch';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { AirportPicker } from '@/ui/AirportPicker';
import { useSettings } from '@/settings/SettingsProvider';
import { changedFilters, DEFAULT_FILTERS, homeAirports, type SearchFilters } from '@/settings/settings';
import { FiltersModal } from '@/ui/FiltersModal';
import { ImpactSheet } from '@/ui/ImpactSheet';
import { LeaveByCard } from '@/ui/LeaveByCard';
import { useCurrentLocation } from '@/ui/useCurrentLocation';
import { ResultsPanel } from '@/ui/ResultsPanel';
import { SearchPanel } from '@/ui/SearchPanel';
import { RadarButton } from '@/ui/RadarButton';
import { Sheet } from '@/ui/Sheet';
import { useRadarLayers } from '@/ui/useRadarLayers';

/** Sample-data route used until a main home is set (Q-026). */
const DEFAULT_ORIGIN = 'BNA';
const DEFAULT_DESTINATION = 'LAX';
/** Peek height above the home indicator. */
const PEEK = 132;
const SHEET = { peek: 0, half: 1, full: 2 } as const;

const airport = (code: string) => AIRPORTS[code];
const mark = (code: string): MapAirport => ({ code, coord: [AIRPORTS[code].lon, AIRPORTS[code].lat] });

/**
 * Home: globe behind a bottom sheet holding search, then results.
 * DECISIONS.md: no tabs; top bar = wordmark, Requests pill, Profile.
 */
export default function HomeScreen() {
  const c = useColors();
  const [origin, setOrigin] = useState<string | null>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<string | null>(DEFAULT_DESTINATION);
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null);
  const { settings, update: updateSettings } = useSettings();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  // Each search starts from the saved defaults (Settings).
  useEffect(() => setFilters(settings.search), [settings.search]);
  const { location, status: locationStatus, request: requestLocation } = useCurrentLocation(settings.useLocation);
  const homes = useMemo(() => homeAirports(settings.homes), [settings.homes]);
  const mainHome = settings.homes.main;
  // Search "From" starts at the main home (Q-026).
  useEffect(() => {
    if (mainHome) setOrigin(mainHome);
  }, [mainHome]);
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

  // Delay/weather badges (item 7). Until the live functions are deployed the
  // hook reports 'off'; dev builds then show clearly labeled sample impacts.
  const live = useRouteImpacts(results);
  const sampleImpacts = __DEV__ && live.state === 'off';
  const impacts = useMemo(
    () => (sampleImpacts ? sampleRouteImpacts(results) : live),
    [sampleImpacts, results, live],
  );
  const [impactFor, setImpactFor] = useState<string | null>(null);

  // Radar overlay (items 13-14): on by default, remembered (Q-032).
  const radar = useRadarLayers(settings.radarOn, now);
  const statusMarks = useMemo(
    () => impacts.airports.map((a) => ({ ...mark(a.code), level: a.level })),
    [impacts.airports],
  );

  const runSearch = useCallback(
    (d = date, to = destination) => {
      if (!origin || !to) return;
      setSelectedId(null);
      setSheetIndex(SHEET.half);
      search({ origin, destination: to, date: d }, filters);
    },
    [origin, destination, date, filters, search],
  );

  // Get Home: shown when away from every home (Q-026).
  const awayFromHome = mainHome != null && origin != null && !homes.some((h) => h.code === origin);
  const getHome = () => {
    if (!mainHome) return;
    setDestination(mainHome);
    runSearch(date, mainHome);
  };

  // Map marks (item 9): homes (main first), the search origin, and the requested
  // destination plus any nearby airport a result actually lands at.
  const homeMarks = useMemo(() => homes.map((h) => mark(h.code)), [homes]);
  const searched = state.status === 'idle' ? null : state.request;
  const markOrigin = searched?.origin ?? origin;
  const markDestinations = useMemo(() => {
    const to = searched?.destination ?? destination;
    const codes = new Set(to ? [to] : []);
    for (const r of results) codes.add(r.destination);
    return [...codes].map(mark);
  }, [searched, destination, results]);

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
  const filtersChanged = changedFilters(filters, settings.search);
  const selected = results.find((r) => r.id === selectedId);
  const firstLeg = selected?.legs[0].flight;
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
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Profile and settings"
            style={[styles.pill, { backgroundColor: c.surface2 }]}>
            <Text style={[textStyles.bodyStrong, { color: c.text }]}>Profile</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body} onLayout={onBodyLayout}>
        <GlobeMap
          routes={routes}
          homeAirports={homeMarks}
          origin={markOrigin ? mark(markOrigin) : null}
          destinations={markDestinations}
          airportStatus={statusMarks}
          radar={radar.layers}
          selectedRouteId={selectedId}
          onSelectRoute={select}
          insets={{ bottom: snaps[sheetIndex] }}
        />
        {radar.available ? (
          <RadarButton
            on={settings.radarOn}
            caption={radar.caption}
            onToggle={() => updateSettings({ radarOn: !settings.radarOn })}
          />
        ) : null}
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
                onGetHome={awayFromHome ? getHome : undefined}
                onSetHome={mainHome ? undefined : () => router.push('/settings')}
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
                impacts={impacts.byId}
                impactsLoading={!sampleImpacts && live.state === 'loading'}
                onImpactPress={setImpactFor}
                sampleImpacts={sampleImpacts}
                selectedCard={
                  firstLeg ? (
                    <LeaveByCard
                      airport={AIRPORTS[firstLeg.from]}
                      departUtc={firstLeg.departUtc}
                      bufferMin={settings.bufferMin}
                      now={now}
                      location={location}
                      locationStatus={locationStatus}
                      onUseLocation={async () => {
                        if (await requestLocation()) updateSettings({ useLocation: true });
                      }}
                    />
                  ) : null
                }
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
      <ImpactSheet
        visible={impactFor !== null}
        title="Delays and weather"
        impact={impactFor ? (impacts.byId[impactFor] ?? null) : null}
        now={now}
        sample={sampleImpacts}
        onClose={() => setImpactFor(null)}
      />
      <FiltersModal
        visible={filtersOpen}
        filters={filters}
        defaults={settings.search}
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
