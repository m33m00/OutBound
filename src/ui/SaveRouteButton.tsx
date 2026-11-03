import { type ComponentRef, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { minTapTarget, useColors } from '@/theme';

import { selectionTick, successTap } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { useTearAway, type TearTicket } from './TearAway';

/**
 * Bookmark in a picked route's header (Q-043), where iOS puts bookmark
 * actions, so it's in view at any panel height. Filled once the route is in
 * My Trips; tapping again takes it back out.
 */
export function SaveRouteButton({ saved, onPress, ticket }: { saved: boolean; onPress: () => void; ticket?: TearTicket }) {
  const c = useColors();
  const tearAway = useTearAway();
  const self = useRef<ComponentRef<typeof View>>(null);
  return (
    <Pressable
      ref={self}
      onPress={() => {
        // Saving lands with the "done" tap; taking it back out is just a tick.
        if (saved) selectionTick();
        else successTap();
        // Saving tears a little ticket off and drops it into My Trips (round 125, John).
        if (!saved && ticket && tearAway) {
          self.current?.measureInWindow((x, y, width, height) => tearAway({ x, y, width, height }, ticket));
        }
        onPress();
        // The icon is the only change on screen, so VoiceOver says what happened.
        AccessibilityInfo.announceForAccessibility(saved ? 'Removed from My Trips' : 'Saved to My Trips');
      }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Saved to My Trips' : 'Save Route'}
      accessibilityHint={saved ? 'Removes it from My Trips' : 'Keeps it in My Trips'}
      testID="save-route"
      style={pressStyle(styles.button, 'link')}>
      <Icon name={saved ? 'bookmark.fill' : 'bookmark'} size={20} tintColor={c.accent} fallback={null} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: minTapTarget, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
