import { EmptyState } from '@/ui/EmptyState';
import { TabScreen } from '@/ui/TabScreen';

/** Request feed: your airline's asks (Q-042). Empty state until the requests backend exists. */
export default function FeedScreen() {
  return (
    <TabScreen title="Feed">
      <EmptyState
        icon="text.bubble"
        title="No requests yet"
        body="Seat requests aren't live yet. When they are, this is where you help people at your airline get on."
        points={[
          'Asks from people at your airline',
          'Answer with open seats and nonrevs listed',
          'Your own asks show up here too',
        ]}
      />
    </TabScreen>
  );
}
