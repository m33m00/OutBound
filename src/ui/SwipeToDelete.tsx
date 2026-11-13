import { type ReactNode, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { fonts, radius, textStyles, useColors } from '@/theme';

import { impactTick, selectionTick } from './haptics';
import { Icon } from './Icon';
import { useReducedMotion } from './useReducedMotion';

/** The red Delete button's width when a row is swiped open. */
export const DELETE_W = 88;
/** A swipe starts once the finger is this far sideways; this far up or down first and it's a scroll. */
const START = 12;
const SCROLL = 14;

/**
 * Where a swipe ends (round 167): past 55% of the card, or a hard flick past the button, deletes at once;
 * past half the button it stays open on Delete; anything less snaps back.
 */
export function swipeOutcome(x: number, velocityX: number, width: number): 'delete' | 'open' | 'close' {
  if (width > 0 && (x <= -width * 0.55 || (velocityX < -1200 && x < -DELETE_W))) return 'delete';
  if (x <= -DELETE_W / 2) return 'open';
  return 'close';
}

/**
 * Swipe left to delete, the iOS way (round 167, John: "I should be able to swipe left to delete a saved
 * route"). The card slides over a red Delete button; a long swipe deletes straight away. While it's open, a tap
 * on the card closes it instead of opening the route. VoiceOver keeps the card's own trash button, so this
 * gesture is extra.
 */
export function SwipeToDelete({
  children,
  onDelete,
  label,
  enabled = true,
}: {
  children: ReactNode;
  onDelete: () => void;
  /** Spoken name of what goes ("Delete DFW to LAX"). */
  label: string;
  enabled?: boolean;
}) {
  const c = useColors();
  const reduceMotion = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(0);
  const base = useRef(0);
  const [open, setOpen] = useState(false);
  const live = useRef({ onDelete, reduceMotion });
  live.current = { onDelete, reduceMotion };

  const settle = (to: number, then?: () => void) => {
    setOpen(to === -DELETE_W);
    if (live.current.reduceMotion) {
      x.setValue(to);
      then?.();
      return;
    }
    Animated.spring(x, { toValue: to, useNativeDriver: true, speed: 22, bounciness: 0 }).start(() => then?.());
  };
  const remove = () => {
    impactTick();
    settle(-width.current - 40, () => {
      live.current.onDelete();
      x.setValue(0);
      setOpen(false);
    });
  };

  const pan = usePanGesture({
    enabled,
    runOnJS: true,
    disableReanimated: true,
    activeOffsetX: [-START, START],
    failOffsetY: [-SCROLL, SCROLL],
    onActivate: () => {
      base.current = open ? -DELETE_W : 0;
    },
    onUpdate: (e) => {
      // Only to the left; a little give past the card's own width.
      x.setValue(Math.min(0, base.current + e.translationX));
    },
    onDeactivate: (e) => {
      const end = base.current + e.translationX;
      const out = e.canceled ? (open ? 'open' : 'close') : swipeOutcome(end, e.velocityX, width.current);
      if (out === 'delete') remove();
      else {
        if (out === 'open' && !open) selectionTick();
        settle(out === 'open' ? -DELETE_W : 0);
      }
    },
  });

  // The red only shows once the card moves, so it never peeks out at the card's round corners.
  const redOpacity = x.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  return (
    <View onLayout={(e) => (width.current = e.nativeEvent.layout.width)} testID="swipe-to-delete">
      <Animated.View style={[styles.behind, { backgroundColor: c.canceled, opacity: redOpacity }]}>
        <Pressable
          onPress={remove}
          accessibilityRole="button"
          accessibilityLabel={label}
          // The card's own trash button is how VoiceOver deletes; this one only shows mid-swipe.
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          testID="swipe-delete"
          style={styles.button}>
          <Icon name="trash" size={20} tintColor="#ffffff" fallback={null} />
          <Text style={[textStyles.small, styles.words]}>Delete</Text>
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={{ transform: [{ translateX: x }] }}>
          {children}
          {/* While open, a tap on the card closes it rather than opening the route. */}
          {open ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => settle(0)}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID="swipe-close"
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  behind: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    borderRadius: radius.all,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  button: { width: DELETE_W, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 4 },
  words: { color: '#ffffff', fontFamily: fonts.bodySemiBold },
});
