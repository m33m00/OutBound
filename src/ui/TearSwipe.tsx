import { useMemo, useRef } from 'react';
import { AccessibilityInfo, PanResponder, StyleSheet, View, type PanResponderGestureState } from 'react-native';

import { successTap } from './haptics';
import { useTearDrag, type TearDrag, type TearSource } from './TearAway';
import { dragProgress, shouldCommit } from './tearMesh';

/** How far above and below the perforation line the swipe can start, in points. */
export const SWIPE_REACH = 16;

/** A left swipe that's clearly sideways, so scrolling the card up and down still works. */
export function isTearSwipe(g: Pick<PanResponderGestureState, 'dx' | 'dy'>): boolean {
  return g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
}

/**
 * Swipe left on the perforation to save (round 133, John: "can it be swipe left on the perforation to
 * save the flight? It rips away and looks realistic"). Lies over the route card's perforation; your
 * finger drives the paper tear, and letting go far enough saves the route. Save in the corner still
 * works, and is how VoiceOver saves, so this strip is hidden from it. With Reduce Motion the swipe
 * still saves, without the tear.
 */
export function TearSwipe({ source, onSave }: { source: TearSource; onSave?: () => void }) {
  const startDrag = useTearDrag();
  const width = useRef(0);
  const drag = useRef<TearDrag | null>(null);
  const live = useRef({ source, onSave, startDrag });
  live.current = { source, onSave, startDrag };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => !!live.current.onSave && isTearSwipe(g),
        onMoveShouldSetPanResponder: (_e, g) => !!live.current.onSave && isTearSwipe(g),
        // Once the paper is in your fingers, the sheet's scroll can't take it away.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          drag.current = live.current.startDrag?.(live.current.source) ?? null;
        },
        onPanResponderMove: (_e, g) => {
          drag.current?.move(dragProgress(g.dx, width.current));
        },
        onPanResponderRelease: (_e, g) => {
          const commit = shouldCommit(dragProgress(g.dx, width.current), g.vx);
          drag.current?.release(commit);
          drag.current = null;
          if (!commit) return;
          successTap();
          live.current.onSave?.();
          AccessibilityInfo.announceForAccessibility('Saved to My Trips');
        },
        onPanResponderTerminate: () => {
          drag.current?.release(false);
          drag.current = null;
        },
      }),
    [],
  );

  if (!onSave) return null;
  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      style={styles.strip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="tear-swipe"
    />
  );
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, right: 0, top: -SWIPE_REACH, bottom: -SWIPE_REACH },
});
