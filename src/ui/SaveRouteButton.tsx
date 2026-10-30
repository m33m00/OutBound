import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';

import { minTapTarget, useColors } from '@/theme';

import { withTick } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';

/**
 * Bookmark in a picked route's header (Q-043), where iOS puts bookmark
 * actions, so it's in view at any panel height. Filled once the route is in
 * My Trips; tapping again takes it back out.
 */
export function SaveRouteButton({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={withTick(() => {
        onPress();
        // The icon is the only change on screen, so VoiceOver says what happened.
        AccessibilityInfo.announceForAccessibility(saved ? 'Removed from My Trips' : 'Saved to My Trips');
      })}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Saved to My Trips' : 'Save Route'}
      accessibilityHint={saved ? 'Removes it from My Trips' : 'Keeps it in My Trips'}
      testID="save-route"
      style={pressStyle(styles.button, 'link')}>
      <Icon
        name={saved ? 'bookmark.fill' : 'bookmark'}
        size={20}
        tintColor={c.accent}
        fallback={null}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: minTapTarget - 8, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
