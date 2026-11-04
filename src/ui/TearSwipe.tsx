import { useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { useColors } from '@/theme';

import { impactTick, successTap } from './haptics';
import { Icon } from './Icon';
import { useTearDrag, type TearDrag, type TearSource } from './TearAway';
import { dragProgress, shouldCommit } from './tearMesh';

/** How far above and below the perforation line the swipe can start, in points. */
export const SWIPE_REACH = 18;
/** A swipe starts once the finger is this far left; this far up or down first and it's a scroll. */
export const SWIPE_START = 10;
export const SWIPE_SCROLL = 14;
/**
 * The grab tab at the right notch, in points from the card's right edge. Only a pull that starts here tears;
 * a swipe anywhere else on the card, the dashes included, flips routes (round 138, John: "I did accidentally
 * save a couple flights that I didn't mean to save").
 */
export const GRAB_WIDTH = 64;

/**
 * Swipe left on the perforation to save (round 133, John: "can it be swipe left on the perforation to
 * save the flight? It rips away and looks realistic"). Your finger drives the paper tear, and letting go
 * far enough saves the route. Save in the corner still works, and is how VoiceOver saves, so this strip is
 * hidden from it. With Reduce Motion the swipe still saves, without the tear.
 *
 * Round 134 (John: "The swipe left to tear and save doesnt work"): a native pan, like the panel's
 * handle, instead of a JS responder, which the card's scroll view took the touch from.
 *
 * Round 138: the pull starts only from a small scissors tab at the right notch, gives a light tap as the
 * paper starts to give, and has to go well past halfway (or be a hard flick past the middle). The tear itself
 * is unchanged.
 */
export function TearSwipe({ source, onSave }: { source: TearSource; onSave?: () => void }) {
  const c = useColors();
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
      impactTick();
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
    // The full strip only measures the card's width (the pull's length); touches pass through to the card.
    <View
      pointerEvents="box-none"
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      style={styles.strip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="tear-swipe">
      <GestureDetector gesture={pan}>
        <View collapsable={false} style={styles.grab} testID="tear-grab">
          <View style={[styles.mark, { backgroundColor: c.surface }]}>
            <Icon
              name="scissors"
              size={12}
              tintColor={c.muted}
              fallback={<Text style={{ color: c.muted, fontSize: 11 }}>✂</Text>}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: 0, right: 0, top: -SWIPE_REACH, bottom: -SWIPE_REACH },
  grab: { position: 'absolute', right: 0, top: 0, bottom: 0, width: GRAB_WIDTH, justifyContent: 'center' },
  // Just inside the right notch, sitting on the dashes like a "cut here" mark.
  mark: { position: 'absolute', right: 12, paddingHorizontal: 3, paddingVertical: 1 },
});
