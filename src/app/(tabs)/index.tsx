import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIRPORTS, localDate, toRouteLine, type Flight, type Itinerary } from '@/engine';
import { flightLookupKey, sampleRouteImpacts, useFlightStatuses, useRouteImpacts } from '@/live';
import { GlobeMap, type MapAirport } from '@/map';
import { nearestAirport } from '@/search/airports';
import { searchRequest } from '@/search/areas';
import { dateChips } from '@/search/dates';
import { chooseOrigin, showLocationCard } from '@/search/origin';
import { legLookup, resultsBanner, rowStatus, statusLookups } from '@/search/statusTags';
import { SAMPLE_TZ, SCHEDULE_SOURCE, useRouteSearch } from '@/search/useRouteSearch';
import { minTapTarget, spacing, textStyles, useColors } from '@/theme';
import { AirportPicker } from '@/ui/AirportPicker';
import { useSettings } from '@/settings/SettingsProvider';
import { changedFilters, DEFAULT_FILTERS, homeAirports, type SearchFilters } from '@/settings/settings';
import { FiltersModal } from '@/ui/FiltersModal';
import { FlightStatusSheet } from '@/ui/FlightStatusSheet';
import { ImpactSheet } from '@/ui/ImpactSheet';
import { LeaveByCard } from '@/ui/LeaveByCard';
import { PreviewControl, type PreviewPhase } from '@/ui/PreviewControl';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useSharedLocation } from '@/ui/LocationProvider';
import { LocationOptInCard } from '@/ui/LocationOptInCard';
import { ResultsBanner } from '@/ui/ResultsBanner';
import { ResultsPanel } from '@/ui/ResultsPanel';
import { SearchPanel } from '@/ui/SearchPanel';
import { RadarButton } from '@/ui/RadarButton';
import { Sheet } from '@/ui/Sheet';
import { useRadarLayers } from '@/ui/useRadarLayers';

const DEFAULT_DESTINATION = 'LAX';
/** Peek height above the home indicator. */
const PEEK = 132;
const SHEET = { peek: 0, half: 1, full: 2 } as const;

const airport = (code: string) => AIRPORTS[code];
const SAMPLE_STATUS_OPTIONS = { config: null } as const;
const LIVE_STATUS_OPTIONS = {} as const;
/** Real flights (schedule DB, backlog 25) get live statuses; sample flights keep sample statuses. */
const LIVE_FLIGHTS = SCHEDULE_SOURCE === 'live';
const mark = (code: string): MapAirport => ({ code, coord: [AIRPORTS[code].lon, AIRPORTS[code].lat] });

/**
 * Home: globe behind a bottom sheet holding search, then results.
 * The Search tab (Q-042): top bar = wordmark only.
 */
export default function HomeScreen() {
  const c = useColors();
  const [destination, setDestination] = useState<string | null>(DEFAULT_DESTINATION);
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null);
  const { settings, loaded: settingsLoaded, update: updateSettings } = useSettings();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  // Each search starts from the saved defaults (Settings).
  useEffect(() => setFilters(settings.search), [settings.search]);
  const {
    location,
    status: locationStatus,
    permission: locationPermission,
    request: requestLocation,
  } = useSharedLocation();
  const homes = useMemo(() => homeAirports(settings.homes), [settings.homes]);
  const mainHome = settings.homes.main;
  // From (Q-051): a hand pick (picker, swap) wins for the rest of the session,
  // i.e. this JS runtime's lifetime (the Search tab stays mounted while the app
  // runs; a cold start begins fresh). Otherwise the nearest airport when
  // location is on, else main home, else the last searched origin, else empty.
  const [pickedOrigin, setPickedOrigin] = useState<string | null | undefined>(undefined);
  const nearest = useMemo(
    () => (settings.useLocation && location ? nearestAirport(location.lat, location.lon) : null),
    [settings.useLocation, location],
  );
  const origin = chooseOrigin({ picked: pickedOrigin, nearest, mainHome, lastOrigin: settings.lastOrigin });
  const locationCard = showLocationCard({
    settingsLoaded,
    locationAsked: settings.locationAsked,
    useLocation: settings.useLocation,
    permission: locationPermission,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [sheetIndex, setSheetIndex] = useState<number>(SHEET.half);
  const listRef = useRef<FlatList<Itinerary>>(null);
  const { state, search, reset } = useRouteSearch();

  // 0-7 days out, counted in the origin's local calendar (sample-data zone while From is empty).
  const today = localDate(Date.now(), origin ? AIRPORTS[origin].tz : SAMPLE_TZ);
  const chips = useMemo(() => dateChips(today), [today]);
  const [date, setDate] = useState(today);
  useEffect(() => {
    if (!chips.some((chip) => chip.date === date)) setDate(today);
  }, [chips, date, today]);

  const snaps = useMemo(() => {
    const h = Math.max(bodyHeight, PEEK * 3);
    return [PEEK, Math.round(h * 0.48), h - spacing.group];
  }, [bodyHeight]);

  // Ages ("12m ago") keep counting while results are open.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Empty search (Q-047): a banner under Find Routes instead of a results
  // panel. "Show Them" lists the hidden routes for this search only; the
  // saved filters don't change. The banner goes away as soon as the date,
  // From or To no longer match the search it describes.
  const bannerCurrent =
    state.status === 'done' &&
    state.request.date === date &&
    state.request.origin === origin &&
    state.request.destination === destination;
  const emptyBanner = state.status === 'done' ? resultsBanner(state) : null;
  const banner = bannerCurrent ? emptyBanner : null;
  const [showHidden, setShowHidden] = useState(false);
  useEffect(() => setShowHidden(false), [state]);
  const showResults = state.status !== 'idle' && (!emptyBanner || showHidden);
  const results = useMemo(
    () => (state.status !== 'done' ? [] : showHidden ? state.hiddenResults : state.results),
    [state, showHidden],
  );
  const routes = useMemo(() => results.map((it) => toRouteLine(it, airport)), [results]);

  // Delay/weather badges (item 7). Until the live functions are deployed the
  // hook reports 'off'; dev builds then show clearly labeled sample impacts.
  const live = useRouteImpacts(results);
  const sampleImpacts = __DEV__ && live.state === 'off';
  const impacts = useMemo(
    () => (sampleImpacts ? sampleRouteImpacts(results) : live),
    [sampleImpacts, results, live],
  );
  // Live status tags on every row (Q-047, Q-050): one lookup per distinct flight.
  const lookups = useMemo(() => statusLookups(results), [results]);
  // Sample flights get sample statuses; real flights from the schedule DB get live ones.
  const flightStatuses = useFlightStatuses(lookups, LIVE_FLIGHTS ? LIVE_STATUS_OPTIONS : SAMPLE_STATUS_OPTIONS);
  const rowStatuses = useMemo(
    () => Object.fromEntries(results.map((it) => [it.id, rowStatus(it, flightStatuses.byKey, filters)])),
    [results, flightStatuses.byKey, filters],
  );
  const [impactFor, setImpactFor] = useState<string | null>(null);
  const [statusFlight, setStatusFlight] = useState<Flight | null>(null);

  // Flight preview (item 11; button only, Q-035): plane + moving night (Q-034).
  const reduceMotion = useReducedMotion();
  const [preview, setPreview] = useState<{ routeId: string; nonce: number } | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{ phase: PreviewPhase; simUtc: number | null; progress: number }>({
    phase: 'idle',
    simUtc: null,
    progress: 0,
  });
  useEffect(() => {
    // A different (or no) route resets the preview.
    setPreview(null);
    setPreviewInfo({ phase: 'idle', simUtc: null, progress: 0 });
  }, [selectedId]);

  // Radar overlay (items 13-14): on by default, remembered (Q-032).
  const radar = useRadarLayers(settings.radarOn, now);
  const statusMarks = useMemo(
    () => impacts.airports.map((a) => ({ ...mark(a.code), level: a.level })),
    [impacts.airports],
  );

  // Area toggles (Q-048): remembered per airport code; off = exactly that airport.
  const areaOn = settings.areaOn;
  const toggleArea = (code: string) => updateSettings({ areaOn: { ...areaOn, [code]: !areaOn[code] } });

  const runSearch = useCallback(
    (d = date, to = destination, toArea?: boolean) => {
      if (!origin || !to) return;
      setSelectedId(null);
      setSheetIndex(SHEET.half);
      // Remembered as the fallback From when location is off (Q-051).
      if (origin !== settings.lastOrigin) updateSettings({ lastOrigin: origin });
      search(searchRequest(origin, to, d, areaOn, toArea), filters);
    },
    [origin, destination, date, filters, search, areaOn, settings.lastOrigin, updateSettings],
  );
  // Re-run the shown search (retry, tomorrow, filters) with its own To and area choice.
  const rerun = (d: string) =>
    state.status === 'idle' ? runSearch(d) : runSearch(d, state.request.destination, !!state.request.destinationArea);

  // Get Home: shown when away from every home (Q-026).
  const awayFromHome = mainHome != null && origin != null && !homes.some((h) => h.code === origin);
  const getHome = () => {
    if (!mainHome) return;
    setDestination(mainHome);
    // Always the whole home area, whatever its toggle says (Q-048).
    runSearch(date, mainHome, true);
  };

  // Map marks (item 9): homes (main first), the search origin, and the requested
  // destination plus any area airport a result actually lands at. Area origins
  // (e.g. DAL when From is DFW) get a ring when their route is selected.
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
  const impactIt = impactFor ? results.find((r) => r.id === impactFor) : undefined;
  const impactRoute = impactIt ? [impactIt.origin, ...impactIt.legs.map((l) => l.flight.to)].join(' → ') : null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={[textStyles.wordmark, { color: c.text }]} accessibilityRole="header">
          OutBound
        </Text>
      </View>

      <View style={styles.body} onLayout={onBodyLayout}>
        <GlobeMap
          routes={routes}
          homeAirports={homeMarks}
          origin={markOrigin ? mark(markOrigin) : null}
          destinations={markDestinations}
          airportStatus={statusMarks}
          radar={radar.layers}
          preview={preview}
          onPreviewState={(s) =>
            setPreviewInfo({ phase: s.phase, simUtc: s.simUtc, progress: s.progress })
          }
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
            {!showResults ? (
              <SearchPanel
                chips={chips}
                date={date}
                onDate={setDate}
                origin={origin}
                destination={destination}
                onPickOrigin={() => setPicking('origin')}
                onPickDestination={() => setPicking('destination')}
                onSwap={() => {
                  setPickedOrigin(destination);
                  setDestination(origin);
                }}
                areaOn={areaOn}
                onToggleArea={toggleArea}
                onFilters={() => setFiltersOpen(true)}
                filtersChanged={filtersChanged}
                onFind={() => runSearch()}
                sampleFlights={!LIVE_FLIGHTS}
                onGetHome={awayFromHome ? getHome : undefined}
                onSetHome={mainHome ? undefined : () => router.push('/settings')}
                locationCard={
                  locationCard ? (
                    <LocationOptInCard
                      onAllow={async () => {
                        // A denial hides the card too (permission is no longer undetermined).
                        updateSettings((await requestLocation()) ? { useLocation: true } : { locationAsked: true });
                      }}
                      onNotNow={() => updateSettings({ locationAsked: true })}
                    />
                  ) : null
                }
                banner={
                  banner ? (
                    <ResultsBanner banner={banner} onShow={() => setShowHidden(true)} onDismiss={reset} />
                  ) : null
                }
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
                onRetry={() => rerun(state.request.date)}
                impacts={impacts.byId}
                impactsLoading={!sampleImpacts && live.state === 'loading'}
                onImpactPress={setImpactFor}
                onLegPress={setStatusFlight}
                sampleImpacts={sampleImpacts}
                statuses={rowStatuses}
                sampleStatus={flightStatuses.sample && results.length > 0}
                sampleFlights={!LIVE_FLIGHTS}
                showingHidden={showHidden}
                selectedCard={
                  firstLeg ? (
                    <View style={styles.selectedCard}>
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
                      <PreviewControl
                        phase={previewInfo.phase}
                        simUtc={previewInfo.simUtc}
                        progress={previewInfo.progress}
                        onPlay={() => {
                          if (reduceMotion) {
                            setPreviewInfo({ phase: 'reduceMotion', simUtc: null, progress: 0 });
                            return;
                          }
                          setPreview({ routeId: selectedId!, nonce: Date.now() });
                          setPreviewInfo({ phase: 'playing', simUtc: null, progress: 0 });
                        }}
                        onStop={() => {
                          setPreview(null);
                          setPreviewInfo({ phase: 'idle', simUtc: null, progress: 0 });
                        }}
                      />
                    </View>
                  ) : null
                }
              />
            )}
          </Sheet>
        ) : null}
      </View>

      <AirportPicker
        visible={picking !== null}
        title={picking === 'origin' ? 'From' : 'To'}
        current={picking === 'origin' ? origin : destination}
        nearest={nearest}
        homes={homes}
        onPick={(code) => {
          if (picking === 'origin') setPickedOrigin(code);
          else setDestination(code);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <ImpactSheet
        visible={impactFor !== null}
        title="Delays and weather"
        subtitle={impactRoute}
        impact={impactFor ? (impacts.byId[impactFor] ?? null) : null}
        now={now}
        sample={sampleImpacts}
        onClose={() => setImpactFor(null)}
      />
      <FlightStatusSheet
        flight={statusFlight}
        now={now}
        onClose={() => setStatusFlight(null)}
        // Sample flights never ask the live service about a made-up flight.
        liveOptions={LIVE_FLIGHTS ? undefined : SAMPLE_STATUS_OPTIONS}
        // Sample rows open the same sample status their tag shows.
        sample={
          statusFlight && flightStatuses.sample
            ? (flightStatuses.byKey[flightLookupKey(legLookup(statusFlight))] ?? null)
            : null
        }
      />
      <FiltersModal
        visible={filtersOpen}
        filters={filters}
        defaults={settings.search}
        onChange={setFilters}
        onClose={() => {
          setFiltersOpen(false);
          if (state.status !== 'idle') rerun(state.request.date);
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
  body: {
    flex: 1,
  },
  selectedCard: {
    gap: spacing.group,
  },
});
