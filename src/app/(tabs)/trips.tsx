import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Flight } from '@/engine';
import { flightLookupKey, useFlightStatuses } from '@/live';
import { MAX_OPEN_REQUESTS, openRequestCount, upcomingRequests } from '@/requests/requests';
import { useRequests } from '@/requests/RequestsProvider';
import { legLookup, legStatus } from '@/search/statusTags';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { spacing, useColors } from '@/theme';
import { confirmRemove } from '@/trips/confirmRemove';
import { dropExpired, isPast, savedRouteTitle, sortSaved, type SavedRoute } from '@/trips/savedRoutes';
import { useSavedRoutes } from '@/trips/SavedRoutesProvider';
import { Button, PillButton } from '@/ui/Buttons';
import { EmptyState } from '@/ui/EmptyState';
import { FlightStatusSheet } from '@/ui/FlightStatusSheet';
import { selectionTick } from '@/ui/haptics';
import { Icon } from '@/ui/Icon';
import { ListGroup, SectionFooter } from '@/ui/ListGroup';
import { RequestRow } from '@/ui/RequestRow';
import { SavedRouteCard } from '@/ui/SavedRouteCard';
import { SavedToast } from '@/ui/SavedToast';
import { SwipeToDelete } from '@/ui/SwipeToDelete';
import { TabScreen } from '@/ui/TabScreen';
import { TripsSectionHeader } from '@/ui/TripsSectionHeader';
import { useFlightLoad } from '@/ui/useFlightLoad';
import { useSheetContent } from '@/ui/useSheetContent';

/**
 * Your own load requests and saved routes (Q-042). Saved routes (Q-043, John
 * 2026-10-30): no limit, and opening one runs its day's search again in the
 * Search tab. Until the requests backend exists, "Your requests" shows
 * example asks on sample flights (design round 31) plus any you make from a
 * flight in Search this session (round 32).
 */
export default function TripsScreen() {
  const c = useColors();
  const { routes, loaded, open, remove, removeMany, save, expire } = useSavedRoutes();
  // Read the clock each time the tab shows, so a day that passed overnight reads as passed,
  // and routes whose last flight landed over 24 hours ago come off (round 167).
  const [now, setNow] = useState(Date.now());
  useFocusEffect(
    useCallback(() => {
      const t = Date.now();
      setNow(t);
      expire(t);
    }, [expire]),
  );
  const list = sortSaved(dropExpired(routes, now), now);
  // Select to delete several at once (round 167, John).
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
  };
  const toggle = (key: string) => {
    selectionTick();
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  };
  const allPicked = list.length > 0 && list.every((r) => picked.includes(r.key));
  const deletePicked = () => {
    const n = picked.length;
    if (!n) return;
    Alert.alert(`Delete ${n} saved ${n === 1 ? 'route' : 'routes'}?`, 'They come off My Trips on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeMany(picked);
          stopSelecting();
        },
      },
    ]);
  };
  // A swiped-away route can come back for a few seconds.
  const [swiped, setSwiped] = useState<SavedRoute | null>(null);
  const clearSwiped = useCallback(() => setSwiped(null), []);
  const { mine } = useRequests();
  const openCount = openRequestCount(mine, now);
  // A request opens its flight: status, seats, and Cancel Request while it waits (round 34).
  const [flightOpen, setFlightOpen] = useState<Flight | null>(null);
  const flightSheet = useSheetContent(flightOpen);
  const load = useFlightLoad(flightSheet.shown, now, { fromTrips: true });
  // Sample flights show the same sample status Search does; live ones ask the status service.
  const live = SCHEDULE_SOURCE === 'live';
  const lookups = useMemo(() => mine.map((r) => legLookup(r.flight)), [mine]);
  const statuses = useFlightStatuses(lookups, live ? {} : SAMPLE_STATUS_OPTIONS);
  // Only flights still to leave; one that live data says departed or arrived drops off too.
  const requests = upcomingRequests(mine, now, (r) => {
    const kind = legStatus(r.flight, statuses.byKey[flightLookupKey(legLookup(r.flight))]).tag?.kind;
    return kind === 'departed' || kind === 'arrived';
  });
  // Tick at the next departure so that flight drops off while the tab is open.
  // Answered ones stay after they leave (round 167), so only flights still to go count.
  const nextDepart = requests.find((r) => r.flight.departUtc > now)?.flight.departUtc;
  useEffect(() => {
    if (nextDepart == null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextDepart - Date.now()) + 1000);
    return () => clearTimeout(timer);
  }, [nextDepart, now]);
  const sheet = (
    <FlightStatusSheet
      flight={flightSheet.shown}
      visible={flightSheet.visible}
      now={now}
      onClose={() => setFlightOpen(null)}
      liveOptions={live ? undefined : SAMPLE_STATUS_OPTIONS}
      sample={
        flightSheet.shown && statuses.sample ? (statuses.byKey[flightLookupKey(legLookup(flightSheet.shown))] ?? null) : null
      }
      load={load}
    />
  );

  if (!list.length && !requests.length) {
    return (
      <TabScreen title="My Trips">
        {loaded ? (
          <EmptyState
            icon="suitcase"
            title="No trips yet"
            body="Routes you bookmark in Search and answers to your load requests show up here."
          />
        ) : null}
        {sheet}
      </TabScreen>
    );
  }

  const selectBar = selecting ? (
    <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.cardEdge }]} testID="select-bar">
      <PillButton
        label={allPicked ? 'Deselect All' : 'Select All'}
        onPress={() => setPicked(allPicked ? [] : list.map((r) => r.key))}
        testID="select-all"
      />
      <Button
        label={picked.length ? `Delete ${picked.length}` : 'Delete'}
        kind="danger"
        icon="trash"
        disabled={!picked.length}
        onPress={deletePicked}
        style={styles.barDelete}
      />
    </View>
  ) : swiped ? (
    <SavedToast
      label="Route deleted"
      icon="trash"
      undoLabel="Undo delete"
      undone="Back in My Trips"
      testID="deleted-toast"
      onUndo={() => save(swiped)}
      onDone={clearSwiped}
    />
  ) : null;

  return (
    <TabScreen title="My Trips" overlay={selectBar}>
      {requests.length ? (
        <View style={styles.section}>
          <TripsSectionHeader icon="text.bubble.fill" title="Your requests" count={requests.length} testID="requests-header" />
          <ListGroup>
            {requests.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                now={now}
                mine
                leg={legStatus(r.flight, statuses.byKey[flightLookupKey(legLookup(r.flight))])}
                onOpen={() => setFlightOpen(r.flight)}
              />
            ))}
          </ListGroup>
          <SectionFooter>{`${openCount} of ${MAX_OPEN_REQUESTS} requests open`}</SectionFooter>
        </View>
      ) : null}
      <View style={[styles.section, selecting && styles.roomForBar]}>
        <TripsSectionHeader
          icon="bookmark.fill"
          title="Saved routes"
          count={list.length || undefined}
          rule={requests.length > 0}
          testID="saved-header"
          action={
            list.length ? (
              <PillButton
                label={selecting ? 'Done' : 'Select'}
                tone={selecting ? 'filled' : 'soft'}
                onPress={selecting ? stopSelecting : () => setSelecting(true)}
                testID="select-saved"
              />
            ) : null
          }
        />
        {/* No saved routes yet: say where the bookmark is and give a way there (round 52). */}
        {/* No Find Routes button: the Search tab is one tap away (John, 2026-11-02). */}
        {list.length ? null : (
          <SectionFooter>Open a route in Search, then tap the bookmark beside its name to keep it here.</SectionFooter>
        )}
        {list.map((route) => {
          const card = (
            <SavedRouteCard
              route={route}
              past={isPast(route, now)}
              now={now}
              selecting={selecting}
              onOpen={() => {
                open(route);
                router.navigate('/');
              }}
              onRemove={() => confirmRemove(savedRouteTitle(route), () => remove(route.key))}
            />
          );
          if (selecting) {
            const on = picked.includes(route.key);
            return (
              <Pressable
                key={route.key}
                onPress={() => toggle(route.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={savedRouteTitle(route)}
                testID="saved-select-row"
                style={styles.selectRow}>
                <View
                  style={[styles.check, on ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.line2 }]}
                  testID={on ? 'saved-checked' : 'saved-unchecked'}>
                  {on ? <Icon name="checkmark" size={13} weight="bold" tintColor={c.onAccent} fallback={null} /> : null}
                </View>
                <View style={styles.selectCard} pointerEvents="none">
                  {card}
                </View>
              </Pressable>
            );
          }
          return (
            <SwipeToDelete
              key={route.key}
              label={`Delete ${savedRouteTitle(route)}`}
              onDelete={() => {
                remove(route.key);
                setSwiped(route);
              }}>
              {card}
            </SwipeToDelete>
          );
        })}
      </View>
      {sheet}
    </TabScreen>
  );
}

const SAMPLE_STATUS_OPTIONS = { config: null } as const;

const styles = StyleSheet.create({
  section: { gap: spacing.group },
  roomForBar: { paddingBottom: 80 },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  selectCard: { flex: 1 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  // Select mode's bar along the bottom: Select All on the left, Delete on the right.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.section,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.group,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barDelete: { minWidth: 140 },
});
