import { Tabs } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { fonts, minTapTarget, useBoldText, useColors } from '@/theme';
import { Icon } from '@/ui/Icon';

/** Bottom tab bar (backlog 16; Q-042): Search · Feed · My Trips · Logbook · Profile. */
export default function TabsLayout() {
  const c = useColors();
  // Redraws the labels when Bold Text changes.
  useBoldText();
  // The picked tab shows its filled icon, as iOS apps do (round 166).
  const icon =
    (name: SFSymbol, filled: SFSymbol = name) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Icon name={focused ? filled : name} size={22} tintColor={color} fallback={null} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.cardEdge },
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
        tabBarItemStyle: { minHeight: minTapTarget },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Search', tabBarIcon: icon('magnifyingglass') }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: icon('text.bubble', 'text.bubble.fill') }} />
      <Tabs.Screen name="trips" options={{ title: 'My Trips', tabBarIcon: icon('suitcase', 'suitcase.fill') }} />
      <Tabs.Screen name="logbook" options={{ title: 'Logbook', tabBarIcon: icon('book.closed', 'book.closed.fill') }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: icon('person.crop.circle', 'person.crop.circle.fill') }}
      />
    </Tabs>
  );
}
