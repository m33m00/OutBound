import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';

import { minTapTarget, useColors } from '@/theme';

import { selectionTick, successTap } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { useIsTearCopy, useTearAway, useTearSource } from './TearAway';

/**
 * Bookmark in a picked route's header (Q-043), where iOS puts bookmark
 * actions, so it's in view at any panel height. Filled once the route is in
 * My Trips; tapping again takes it back out.
 */
export function SaveRouteButton({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  const c = useColors();
  const tearAway = useTearAway();
  const source = useTearSource();
  // On the torn-off copy flying into My Trips, the bookmark is already filled.
  const isCopy = useIsTearCopy();
  const filled = saved || isCopy;
  return (
    <Pressable
      onPress={() => {
        // Saving lands with the "done" tap; taking it back out is just a tick.
        if (saved) selectionTick();
        else successTap();
        // Saving tears the card's header off along its perforation into My Trips (round 126, John).
        if (!saved && source && tearAway) tearAway(source);
        onPress();
        // The icon is the only change on screen, so VoiceOver says what happened.
        AccessibilityInfo.announceForAccessibility(saved ? 'Removed from My Trips' : 'Saved to My Trips');
      }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Saved to My Trips' : 'Save Route'}
      accessibilityHint={saved ? 'Removes it from My Trips' : 'Keeps it in My Trips'}
      testID="save-route"
      style={pressStyle(styles.button, 'link')}>
      <Icon name={filled ? 'bookmark.fill' : 'bookmark'} size={20} tintColor={c.accent} fallback={null} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: minTapTarget, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
