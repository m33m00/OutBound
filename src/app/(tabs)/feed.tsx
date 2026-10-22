import { Text } from 'react-native';

import { textStyles, useColors } from '@/theme';
import { TabScreen } from '@/ui/TabScreen';

/** Request feed: your airline's asks (Q-042). Placeholder until the requests backend exists. */
export default function FeedScreen() {
  const c = useColors();
  return (
    <TabScreen title="Feed">
      <Text style={[textStyles.body, { color: c.muted }]}>
        Coming soon: seat requests from other employees at your airline, so you can answer what you know.
      </Text>
    </TabScreen>
  );
}
