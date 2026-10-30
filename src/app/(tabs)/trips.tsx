import { router } from 'expo-router';

import { Button } from '@/ui/Buttons';
import { EmptyState } from '@/ui/EmptyState';
import { TabScreen } from '@/ui/TabScreen';

/** Your own open requests and saved routes (Q-042; saved routes open in Q-043). Empty state for now. */
export default function TripsScreen() {
  return (
    <TabScreen title="My Trips">
      <EmptyState
        icon="suitcase"
        title="No trips yet"
        body="Your seat requests and saved routes will live here."
        points={['Up to 5 open seat requests', 'Routes you save from Search']}
        action={<Button label="Find Routes" icon="magnifyingglass" onPress={() => router.navigate('/')} />}
      />
    </TabScreen>
  );
}
