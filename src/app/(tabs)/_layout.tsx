import { Tabs } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { fonts, minTapTarget, useColors } from '@/theme';
import { Icon } from '@/ui/Icon';

/** Bottom tab bar (backlog 16; Q-042): Search · Feed · My Trips · Profile. */
export default function TabsLayout() {
  const c = useColors();
  const icon =
    (name: SFSymbol) =>
    ({ color }: { color: ColorValue }) => <Icon name={name} size={22} tintColor={color} fallback={null} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
        tabBarItemStyle: { minHeight: minTapTarget },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Search', tabBarIcon: icon('magnifyingglass') }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: icon('text.bubble') }} />
      <Tabs.Screen name="trips" options={{ title: 'My Trips', tabBarIcon: icon('suitcase') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person.crop.circle') }} />
    </Tabs>
  );
}
