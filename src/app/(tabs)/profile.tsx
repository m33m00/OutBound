import { router } from 'expo-router';
import { Text } from 'react-native';

import { textStyles, useColors } from '@/theme';
import { Button } from '@/ui/Buttons';
import { TabScreen } from '@/ui/TabScreen';

/** Profile tab. Settings is reached from here (Q-024, Q-042). */
export default function ProfileScreen() {
  const c = useColors();
  return (
    <TabScreen title="Profile">
      <Text style={[textStyles.body, { color: c.muted }]}>
        Homes, your airport buffer and search defaults live in Settings.
      </Text>
      <Button label="Settings" kind="secondary" onPress={() => router.push('/settings')} />
    </TabScreen>
  );
}
