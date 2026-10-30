import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { confirmRemove } from '@/trips/confirmRemove';
import { isPast, savedRouteTitle, sortSaved } from '@/trips/savedRoutes';
import { useSavedRoutes } from '@/trips/SavedRoutesProvider';
import { Button } from '@/ui/Buttons';
import { EmptyState } from '@/ui/EmptyState';
import { SectionFooter, SectionHeader } from '@/ui/ListGroup';
import { SavedRouteCard } from '@/ui/SavedRouteCard';
import { TabScreen } from '@/ui/TabScreen';

/**
 * Your own open requests and saved routes (Q-042). Saved routes (Q-043, John
 * 2026-10-30): no limit, and opening one runs its day's search again in the
 * Search tab. Seat requests come later.
 */
export default function TripsScreen() {
  const { routes, loaded, open, remove } = useSavedRoutes();
  // Read the clock each time the tab shows, so a day that passed overnight reads as passed.
  const [now, setNow] = useState(Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const list = sortSaved(routes, now);

  if (!list.length) {
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
      </TabScreen>
    );
  }

  return (
    <TabScreen title="My Trips">
      <View style={styles.section}>
        <SectionHeader title="Saved routes" />
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
        <SectionFooter>Opening a route searches its day again, so seats and times are up to date.</SectionFooter>
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.group },
});
