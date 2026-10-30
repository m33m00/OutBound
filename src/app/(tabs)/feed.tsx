import { EmptyState } from '@/ui/EmptyState';
import { TabScreen } from '@/ui/TabScreen';

/** Request feed: your airline's asks (Q-042). Empty state until the requests backend exists. */
export default function FeedScreen() {
  return (
    <TabScreen title="Feed">
      <EmptyState
        icon="text.bubble"
        title="No requests right now"
        body="When someone at your airline asks about a flight, it shows up here so you can answer with open seats and nonrevs listed."
      />
    </TabScreen>
  );
}
