import { Text } from 'react-native';

import { textStyles, useColors } from '@/theme';
import { TabScreen } from '@/ui/TabScreen';

/** Your own open requests and saved routes (Q-042; saved routes open in Q-043). Placeholder. */
export default function TripsScreen() {
  const c = useColors();
  return (
    <TabScreen title="My Trips">
      <Text style={[textStyles.body, { color: c.muted }]}>
        Coming soon: your seat requests will show up here.
      </Text>
    </TabScreen>
  );
}
