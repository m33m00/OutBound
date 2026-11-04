import { useRef } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { successTap } from './haptics';
import { useTearDrag, type TearDrag, type TearSource } from './TearAway';
import { dragProgress, shouldCommit } from './tearMesh';

/** How far above and below the perforation line the swipe can start, in points. */
export const SWIPE_REACH = 18;
/** A swipe starts once the finger is this far left; this far up or down first and it's a scroll. */
export const SWIPE_START = 10;
export const SWIPE_SCROLL = 14;

/**
 * Swipe left on the perforation to save (round 133, John: "can it be swipe left on the perforation to
 * save the flight? It rips away and looks realistic"). Lies over the route card's perforation; your
 * finger drives the paper tear, and letting go far enough saves the route. Save in the corner still
 * works, and is how VoiceOver saves, so this strip is hidden from it. With Reduce Motion the swipe
 * still saves, without the tear.
 *
 * Round 134 (John: "The swipe left to tear and save doesnt work"): a native pan, like the panel's
 * handle, instead of a JS responder, which the card's scroll view took the touch from.
 */
export function TearSwipe({ source, onSave }: { source: TearSource; onSave?: () => void }) {
  const startDrag = useTearDrag();
  const width = useRef(0);
  const drag = useRef<TearDrag | null>(null);
  const live = useRef({ source, onSave, startDrag });
  live.current = { source, onSave, startDrag };

  const pan = usePanGesture({
    enabled: !!onSave,
    runOnJS: true,
    disableReanimated: true,
    // Only a swipe to the left starts it; going up or down first leaves it to the scroll.
    activeOffsetX: [-SWIPE_START, 10000],
    failOffsetY: [-SWIPE_SCROLL, SWIPE_SCROLL],
    onActivate: () => {
      drag.current = live.current.startDrag?.(live.current.source) ?? null;
    },
    onUpdate: (e) => {
      drag.current?.move(dragProgress(e.translationX, width.current));
    },
    onDeactivate: (e) => {
      // Velocity comes in points per second; the tear's flick is in points per millisecond.
      const commit = !e.canceled && shouldCommit(dragProgress(e.translationX, width.current), e.velocityX / 1000);
      drag.current?.release(commit);
      drag.current = null;
      if (!commit) return;
      successTap();
      live.current.onSave?.();
      AccessibilityInfo.announceForAccessibility('Saved to My Trips');
    },
  });

  if (!onSave) return null;
  return (
    <GestureDetector gesture={pan}>
      <View
        collapsable={false}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        style={styles.strip}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="tear-swipe"
      />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, right: 0, top: -SWIPE_REACH, bottom: -SWIPE_REACH },
});
