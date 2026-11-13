import { Tabs } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { useRef } from 'react';
import { Animated, type ColorValue } from 'react-native';

import { fonts, minTapTarget, useBoldText, useColors } from '@/theme';
import { useRequests } from '@/requests/RequestsProvider';
import { Icon } from '@/ui/Icon';
import { useChangePop } from '@/ui/motion';

/** Bottom tab bar (backlog 16; Q-042): Search, Requests (was Feed, round 167), My Trips, Logbook, Settings (was Profile, round 174). */
export default function TabsLayout() {
  const c = useColors();
  // Redraws the labels when Bold Text changes.
  useBoldText();
  // Asks waiting on your answer show as a count on the Requests tab (round 167, John).
  const requests = useRequests();
  const waiting = requests.openFeedCount(Date.now());
  // Round 198: when a request lands in My Trips, its tab icon settles in, so you see where it went. Only when
  // one is added, not when one is deleted.
  const lastMine = useRef(requests.mine.length);
  const landed = useRef(0);
  if (requests.mine.length > lastMine.current) landed.current += 1;
  lastMine.current = requests.mine.length;
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
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Requests',
          tabBarIcon: icon('text.bubble', 'text.bubble.fill'),
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarAccessibilityLabel: waiting > 0 ? `Requests, ${waiting} waiting for an answer` : 'Requests',
          tabBarBadgeStyle: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'My Trips',
          tabBarIcon: ({ color, focused }) => <TripsTabIcon color={color} focused={focused} landed={landed.current} />,
        }}
      />
      <Tabs.Screen name="logbook" options={{ title: 'Logbook', tabBarIcon: icon('book.closed', 'book.closed.fill') }} />
      <Tabs.Screen
        name="profile"
        // Profile became Settings with a cog (round 174, John); the route keeps its old name.
        options={{ title: 'Settings', tabBarIcon: icon('gearshape', 'gearshape.fill') }}
      />
    </Tabs>
  );
}

/** My Trips' tab icon, which settles in each time a request lands there (round 198). */
function TripsTabIcon({ color, focused, landed }: { color: ColorValue; focused: boolean; landed: number }) {
  const pop = useChangePop(landed);
  return (
    <Animated.View style={pop} testID="trips-tab-icon">
      <Icon name={focused ? 'suitcase.fill' : 'suitcase'} size={22} tintColor={color} fallback={null} />
    </Animated.View>
  );
}
