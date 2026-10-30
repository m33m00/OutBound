import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIRPORTS, areaFor, localDate, toRouteLine, type Flight, type Itinerary } from '@/engine';
import { flightLookupKey, sampleRouteImpacts, useFlightStatuses, useRouteImpacts } from '@/live';
import { GlobeMap, type LonLat, type MapAirport } from '@/map';
import { nearestAirport } from '@/search/airports';
import { searchRequest } from '@/search/areas';
import { dateChips } from '@/search/dates';
import { chooseOrigin, showLocationCard } from '@/search/origin';
import { departedFirst, legLookup, resultsBanner, rowStatus, statusLookups } from '@/search/statusTags';
import { SAMPLE_TZ, SCHEDULE_SOURCE, useRouteSearch } from '@/search/useRouteSearch';
import { minTapTarget, spacing, textStyles, useColors } from '@/theme';
import { openRequest, reopenOutcome, savedKey, savedRouteFrom, type SavedRoute } from '@/trips/savedRoutes';
import { useSavedRoutes } from '@/trips/SavedRoutesProvider';
import { AirportPicker } from '@/ui/AirportPicker';
import { Appear } from '@/ui/Appear';
import { useSettings } from '@/settings/SettingsProvider';
import { changedFilters, DEFAULT_FILTERS, homeAirports, type SearchFilters } from '@/settings/settings';
import { FiltersModal } from '@/ui/FiltersModal';
import { airportYouAreAt, sampleDepartures } from '@/requests/atAirport';
import { useRequests } from '@/requests/RequestsProvider';
import { AtAirportCard } from '@/ui/AtAirportCard';
import { DeparturesSheet } from '@/ui/DeparturesSheet';
import { FlightStatusSheet } from '@/ui/FlightStatusSheet';
import { useFlightLoad } from '@/ui/useFlightLoad';
import { ImpactSheet } from '@/ui/ImpactSheet';
import { LeaveByCard } from '@/ui/LeaveByCard';
import { useSharedLocation } from '@/ui/LocationProvider';
import { LocationOptInCard } from '@/ui/LocationOptInCard';
import { ResultsBanner } from '@/ui/ResultsBanner';
import { ResultsPanel } from '@/ui/ResultsPanel';
import { SearchPanel } from '@/ui/SearchPanel';
import { RadarButton } from '@/ui/RadarButton';
import { Sheet } from '@/ui/Sheet';
import { useRadarLayers } from '@/ui/useRadarLayers';
import { useSheetContent } from '@/ui/useSheetContent';
import { selectionTick } from '@/ui/haptics';

/** Peek height above the home indicator. */
const PEEK = 132;
const SHEET = { peek: 0, half: 1, full: 2 } as const;
/** Share of the screen body the panel takes while a route is open. */
const ROUTE_VIEW_SHARE = 0.56;

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
  const [destination, setDestination] = useState<string | null>(null);
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
  const homeCenter = useMemo<LonLat | null>(
    () => (origin ? [AIRPORTS[origin].lon, AIRPORTS[origin].lat] : null),
    [origin],
  );
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
  const saved = useSavedRoutes();

  // 0-7 days out, counted in the origin's local calendar (sample-data zone while From is empty).
  const today = localDate(Date.now(), origin ? AIRPORTS[origin].tz : SAMPLE_TZ);
  const chips = useMemo(() => dateChips(today), [today]);
  const [date, setDate] = useState(today);
  useEffect(() => {
    if (!chips.some((chip) => chip.date === date)) setDate(today);
  }, [chips, date, today]);

  // A picked route's view is a little taller than half (John, 2026-10-30) so its
  // leave-by and route card read in full while the globe keeps most of the screen.
  const routeOpen = selectedId != null;
  const snaps = useMemo(() => {
    const h = Math.max(bodyHeight, PEEK * 3);
    return [PEEK, Math.round(h * (routeOpen ? ROUTE_VIEW_SHARE : 0.48)), h - spacing.group];
  }, [bodyHeight, routeOpen]);

  // Ages ("12m ago") keep counting while results are open.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // At-airport shortcut (round 33): within 4 km of an airport, report from its departures board.
  const atAirport = settings.useLocation ? airportYouAreAt(location, now) : null;
  const departures = useMemo(
    () => (atAirport && !LIVE_FLIGHTS ? sampleDepartures(atAirport, now) : []),
    [atAirport, now],
  );
  const [departuresFor, setDeparturesFor] = useState<string | null>(null);
  const departuresSheet = useSheetContent(departuresFor);

  // Empty search (Q-047): a banner at the top of the search panel instead of a results
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
  // First launch: the location card plus the search fields don't fit at half height, so
  // the panel opens full while the card shows and drops to half once it's answered.
  const [locationCardSeen, setLocationCardSeen] = useState(false);
  useEffect(() => {
    if (locationCard && !showResults) {
      setLocationCardSeen(true);
      setSheetIndex(SHEET.full);
    } else if (locationCardSeen && !locationCard && !showResults) {
      setLocationCardSeen(false);
      setSheetIndex(SHEET.half);
    }
  }, [locationCard, locationCardSeen, showResults]);
  // An empty search shows its banner at the top of the search panel, so the panel goes back to half.
  const emptyNow = emptyBanner != null && !showHidden;
  useEffect(() => {
    if (emptyNow) setSheetIndex(SHEET.half);
  }, [emptyNow]);
  const results = useMemo(
    () => (state.status !== 'done' ? [] : showHidden ? state.hiddenResults : state.results),
    [state, showHidden],
  );
  const routes = useMemo(() => results.map((it) => toRouteLine(it, airport)), [results]);

  // Delay/weather badges (item 7). Until the live functions are deployed the
  // hook reports 'off'; dev builds then show sample impacts so the screens look finished (round 30: no labels).
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
  // Sheets keep their content while they slide away (design round 29).
  const statusSheet = useSheetContent(statusFlight);
  const requests = useRequests();
  const statusLoad = useFlightLoad(statusSheet.shown, now);
  const impactSheet = useSheetContent(impactFor);
  const pickerSheet = useSheetContent(picking);

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
      // Results take over (Q-062): the list opens near full height.
      setSheetIndex(SHEET.full);
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
      // Picking a route drops the panel to its route-view height so the globe shows it.
      if (id) setSheetIndex(SHEET.half);
    },
    [],
  );

  // Opening a saved route from My Trips (Q-043): run its day's search again (today once
  // that day has passed), then open the same flights if they're still in the results.
  const { opening, clearOpening } = saved;
  const [reopening, setReopening] = useState<SavedRoute | null>(null);
  const [reopenPast, setReopenPast] = useState(false);
  const [reopenNote, setReopenNote] = useState<{ at: number; text: string } | null>(null);
  useEffect(() => {
    if (!opening) return;
    clearOpening();
    const request = openRequest(opening, Date.now());
    setPickedOrigin(request.origin);
    setDestination(request.destination);
    setDate(request.date);
    setSelectedId(null);
    setReopening(opening);
    setReopenPast(request.date !== opening.request.date);
    search(request, filters);
  }, [opening, clearOpening, search, filters]);
  useEffect(() => {
    if (!reopening || state.status === 'idle' || state.status === 'loading') return;
    setReopening(null);
    if (state.status !== 'done') return;
    const outcome = reopenOutcome(state, reopening, reopenPast);
    // Straight to the route view's height when the flights are there, so the panel doesn't rise and fall.
    if (outcome.kind === 'note') {
      setSheetIndex(SHEET.full);
      return setReopenNote({ at: state.searchedAt, text: outcome.text });
    }
    setReopenNote(null);
    if (outcome.hidden) setShowHidden(true);
    select(outcome.id);
  }, [reopening, reopenPast, state, select]);
  const missingNote =
    state.status === 'done' && reopenNote?.at === state.searchedAt ? reopenNote.text : undefined;

  // Closing the route view goes back to the tall list, at the route you had open.
  const closeRoute = useCallback(
    (id: string) => {
      select(null);
      setSheetIndex(SHEET.full);
      const index = departedFirst(results, rowStatuses).findIndex((r) => r.id === id);
      if (index >= 0) {
        requestAnimationFrame(() =>
          listRef.current?.scrollToIndex({ index, viewPosition: 0.3, animated: false }),
        );
      }
    },
    [select, results, rowStatuses],
  );
  const backToSearch = useCallback(() => {
    setSelectedId(null);
    setSheetIndex(SHEET.half);
    reset();
  }, [reset]);

  // One step back at a time, the same way everywhere (design round 29): a route goes back
  // to the list, the list back to search. Android's back button walks these steps, and
  // tapping the Search tab while you're on it does too, like popping to the top on iOS.
  const stepBack = useCallback((): boolean => {
    if (selectedId) {
      closeRoute(selectedId);
      return true;
    }
    if (showResults) {
      backToSearch();
      return true;
    }
    return false;
  }, [selectedId, showResults, closeRoute, backToSearch]);
  // Only while Search is the tab on screen, so back on another tab isn't taken here.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', stepBack);
      return () => sub.remove();
    }, [stepBack]),
  );
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('tabPress' as never, () => {
        if (navigation.isFocused()) stepBack();
      }),
    [navigation, stepBack],
  );

  // Filters (design round 29): Done re-runs the search only when something changed, and a
  // route you had open stays open if it's still there afterwards.
  const filtersAtOpen = useRef(filters);
  const keepRoute = useRef<string | null>(null);
  const openFilters = () => {
    filtersAtOpen.current = filters;
    setFiltersOpen(true);
  };
  const closeFilters = () => {
    setFiltersOpen(false);
    if (state.status === 'idle' || !changedFilters(filters, filtersAtOpen.current)) return;
    if (!selectedId) return rerun(state.request.date);
    keepRoute.current = selectedId;
    search(state.request, filters);
  };
  useEffect(() => {
    if (state.status === 'loading' || !keepRoute.current) return;
    const id = keepRoute.current;
    keepRoute.current = null;
    if (state.status === 'done' && state.results.some((r) => r.id === id)) return;
    // The route is gone under the new filters: back to the tall list.
    setSelectedId(null);
    setSheetIndex(SHEET.full);
  }, [state]);

  const onBodyLayout = (e: LayoutChangeEvent) => setBodyHeight(e.nativeEvent.layout.height);
  const filtersChanged = changedFilters(filters, settings.search);
  const selected = results.find((r) => r.id === selectedId);
  const firstLeg = selected?.legs[0].flight;
  const impactIt = impactSheet.shown ? results.find((r) => r.id === impactSheet.shown) : undefined;
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
          selectedRouteId={selectedId}
          // Rests on your From airport (your location when it's on) and drifts back there after a spin.
          home={homeCenter}
          // A tap on a route picks it (with the same tick as a row); a tap on empty globe
          // closes the open route the same way "‹ Routes" does.
          onSelectRoute={(id) => {
            if (id) {
              selectionTick();
              select(id);
            } else if (selectedId) closeRoute(selectedId);
          }}
          insets={{ bottom: snaps[sheetIndex] }}
        />
        {radar.available ? (
          <RadarButton
            on={settings.radarOn}
            caption={radar.caption}
            showing={radar.showing}
            onToggle={() => updateSettings({ radarOn: !settings.radarOn })}
          />
        ) : null}
        {bodyHeight > 0 ? (
          <Sheet snaps={snaps} index={sheetIndex} onIndexChange={setSheetIndex}>
            {/* Search and results cross-fade as they swap (design round 29). */}
            <Appear key={showResults ? 'results' : 'search'}>
              {!showResults ? (
                <SearchPanel
                  chips={chips}
                  date={date}
                  onDate={setDate}
                  origin={origin}
                  destination={destination}
                  onPickOrigin={() => setPicking('origin')}
                  originEmptyText={
                    origin
                      ? undefined
                      : locationStatus === 'locating'
                        ? 'Finding nearest airport…'
                        : locationStatus === 'denied'
                          ? 'Location is off. Choose airport'
                          : undefined
                  }
                  onPickDestination={() => setPicking('destination')}
                  onSwap={() => {
                    setPickedOrigin(destination);
                    setDestination(origin);
                  }}
                  areaOn={areaOn}
                  onToggleArea={toggleArea}
                  onFilters={openFilters}
                  filtersChanged={filtersChanged}
                  onFind={() => runSearch()}
                  onGetHome={awayFromHome ? getHome : undefined}
                  homeName={mainHome ? (areaFor(mainHome)?.city ?? mainHome) : undefined}
                  onSetHome={mainHome ? undefined : () => router.push({ pathname: '/settings', params: { section: 'homes' } })}
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
                  airportCard={
                    // Live boards need the schedule feed; until then only sample departures are listed.
                    atAirport && !LIVE_FLIGHTS ? (
                      <AtAirportCard
                        code={atAirport}
                        upcoming={departures.filter((f) => f.departUtc > now).length}
                        onBoard={departures.length}
                        onReport={() => setDeparturesFor(atAirport)}
                      />
                    ) : null
                  }
                  banner={
                    banner ? (
                      <ResultsBanner
                        banner={banner}
                        onShow={() => {
                          setShowHidden(true);
                          setSheetIndex(SHEET.full);
                        }}
                        onDismiss={reset}
                      />
                    ) : null
                  }
                />
              ) : (
                <ResultsPanel
                  ref={listRef}
                  state={state}
                  selectedId={selectedId}
                  now={now}
                  onSelect={(id) => (id !== selectedId ? select(id) : closeRoute(id))}
                  onBack={backToSearch}
                  onRetry={() => rerun(state.request.date)}
                  impacts={impacts.byId}
                  impactsLoading={!sampleImpacts && live.state === 'loading'}
                  onImpactPress={setImpactFor}
                  onLegPress={setStatusFlight}
                  statuses={rowStatuses}
                  sampleFlights={!LIVE_FLIGHTS}
                  showingHidden={showHidden}
                  days={chips}
                  onDay={(d) => {
                    setDate(d);
                    rerun(d);
                  }}
                  onFilters={openFilters}
                  filtersChanged={filtersChanged}
                  note={missingNote}
                  isSaved={(it) => saved.isSaved(savedKey(it, state.request.date))}
                  onToggleSave={(it) => {
                    const key = savedKey(it, state.request.date);
                    if (saved.isSaved(key)) saved.remove(key);
                    else saved.save(savedRouteFrom(it, state.request, Date.now()));
                  }}
                  selectedCard={
                    firstLeg ? (
                      <LeaveByCard
                        airport={AIRPORTS[firstLeg.from]}
                        departUtc={firstLeg.departUtc}
                        departed={!!(selected && rowStatuses?.[selected.id]?.dimmed)}
                        delayedText={selected ? (rowStatuses?.[selected.id]?.legs[0]?.newText ?? null) : null}
                        bufferMin={settings.bufferMin}
                        now={now}
                        location={location}
                        locationStatus={locationStatus}
                        mapsApp={settings.mapsApp}
                        onUseLocation={async () => {
                          if (await requestLocation()) updateSettings({ useLocation: true });
                        }}
                      />
                    ) : null
                  }
                />
              )}
            </Appear>
          </Sheet>
        ) : null}
      </View>

      <AirportPicker
        visible={pickerSheet.visible}
        title={pickerSheet.shown === 'origin' ? 'From' : 'To'}
        current={pickerSheet.shown === 'origin' ? origin : destination}
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
        visible={impactSheet.visible}
        title="Delays and weather"
        subtitle={impactRoute}
        impact={impactSheet.shown ? (impacts.byId[impactSheet.shown] ?? null) : null}
        now={now}
        onClose={() => setImpactFor(null)}
      />
      <FlightStatusSheet
        flight={statusSheet.shown}
        visible={statusSheet.visible}
        now={now}
        onClose={() => setStatusFlight(null)}
        // Sample flights never ask the live service about a made-up flight.
        liveOptions={LIVE_FLIGHTS ? undefined : SAMPLE_STATUS_OPTIONS}
        // Sample rows open the same sample status their tag shows.
        sample={
          statusSheet.shown && flightStatuses.sample
            ? (flightStatuses.byKey[flightLookupKey(legLookup(statusSheet.shown))] ?? null)
            : null
        }
        load={statusLoad}
      />
      <DeparturesSheet
        code={departuresSheet.shown}
        visible={departuresSheet.visible}
        flights={departures}
        now={now}
        reportFor={requests.reportFor}
        onReport={requests.report}
        onClose={() => setDeparturesFor(null)}
      />
      <FiltersModal
        visible={filtersOpen}
        filters={filters}
        defaults={settings.search}
        onChange={setFilters}
        onClose={closeFilters}
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
});
