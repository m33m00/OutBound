import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Flight } from '@/engine';
import { flightLookupKey, useFlightStatuses } from '@/live';
import { MAX_OPEN_REQUESTS, openRequestCount } from '@/requests/requests';
import { useRequests } from '@/requests/RequestsProvider';
import { legLookup } from '@/search/statusTags';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { spacing } from '@/theme';
import { confirmRemove } from '@/trips/confirmRemove';
import { isPast, savedRouteTitle, sortSaved } from '@/trips/savedRoutes';
import { useSavedRoutes } from '@/trips/SavedRoutesProvider';
import { Button } from '@/ui/Buttons';
import { EmptyState } from '@/ui/EmptyState';
import { FlightStatusSheet } from '@/ui/FlightStatusSheet';
import { ListGroup, SectionFooter, SectionHeader } from '@/ui/ListGroup';
import { RequestRow } from '@/ui/RequestRow';
import { SavedRouteCard } from '@/ui/SavedRouteCard';
import { TabScreen } from '@/ui/TabScreen';
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
  const { routes, loaded, open, remove } = useSavedRoutes();
  // Read the clock each time the tab shows, so a day that passed overnight reads as passed.
  const [now, setNow] = useState(Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const list = sortSaved(routes, now);
  const { mine: requests } = useRequests();
  const openCount = openRequestCount(requests);
  // A request opens its flight: status, seats, and Cancel Request while it waits (round 34).
  const [flightOpen, setFlightOpen] = useState<Flight | null>(null);
  const flightSheet = useSheetContent(flightOpen);
  const load = useFlightLoad(flightSheet.shown, now);
  // Sample flights show the same sample status Search does; live ones ask the status service.
  const live = SCHEDULE_SOURCE === 'live';
  const lookups = useMemo(() => requests.map((r) => legLookup(r.flight)), [requests]);
  const statuses = useFlightStatuses(lookups, live ? {} : SAMPLE_STATUS_OPTIONS);
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
            body="Pick a route in Search and tap Save Route to keep it here."
            points={['Up to 5 open seat requests', 'Routes you save from Search']}
            action={<Button label="Find Routes" icon="magnifyingglass" onPress={() => router.navigate('/')} />}
          />
        ) : null}
        {sheet}
      </TabScreen>
    );
  }

  return (
    <TabScreen title="My Trips">
      {requests.length ? (
        <View style={styles.section}>
          <ListGroup title="Your requests">
            {requests.map((r) => (
              <RequestRow key={r.id} request={r} now={now} mine onOpen={() => setFlightOpen(r.flight)} />
            ))}
          </ListGroup>
          <SectionFooter>
            {`${openCount} of ${MAX_OPEN_REQUESTS} requests open. Someone at that airline answers with what they see on the board.`}
          </SectionFooter>
        </View>
      ) : null}
      <View style={styles.section}>
        <SectionHeader title="Saved routes" />
        {list.length ? null : (
          <SectionFooter>Pick a route in Search and tap Save Route to keep it here.</SectionFooter>
        )}
        {list.map((route) => (
          <SavedRouteCard
            key={route.key}
            route={route}
            past={isPast(route, now)}
            now={now}
            onOpen={() => {
              open(route);
              router.navigate('/');
            }}
            onRemove={() => confirmRemove(savedRouteTitle(route), () => remove(route.key))}
          />
        ))}
        {list.length ? (
          <SectionFooter>Opening a route searches its day again, so seats and times are up to date.</SectionFooter>
        ) : null}
      </View>
      {sheet}
    </TabScreen>
  );
}

const SAMPLE_STATUS_OPTIONS = { config: null } as const;

const styles = StyleSheet.create({
  section: { gap: spacing.group },
});
