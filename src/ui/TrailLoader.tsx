/**
 * The one loading animation in the app (round 223, John: "Can you streamline the animation of the T across the
 * app. Where it uses the plane and trail. For anything loading etc").
 *
 * It's the t from the "jaunt" wordmark telling the launch screen's story small: the plane flies in drawing the
 * contrail that becomes the t's crossbar, holds a beat, then takes off and the trail fades, and it goes round
 * again while the wait lasts. Same easing as the launch screen (the draw eases out, the take-off eases in), the
 * same timing everywhere, only the size changes. Every spinner in the app is this now.
 *
 * Pictures, not Skia: the stem, the trail and the plane are three white images in one frame
 * (design/assets/make-loader.py), tinted here and moved with native-driver Animated, so the loader keeps going
 * smoothly while the thing it waits for keeps the JS thread busy. With Reduce Motion on nothing moves: the
 * finished t just fades softly in and out.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotionStatus } from '@/map/useReduceMotion';
import { useColors } from '@/theme';

const STEM = require('../../assets/images/loader-stem.png');
const TRAIL = require('../../assets/images/loader-trail.png');
const PLANE = require('../../assets/images/loader-plane.png');

/** The pictures' frame in the wordmark's font units, and the trail's ends (src/brand/jauntMark.ts). */
const FRAME = { x0: 1960, y0: -880, x1: 2990, y1: 30 } as const;
const TAIL = { x: 2035.34, y: -579.71 };
const HEAD = { x: 2729.82, y: -727.32 };
const HEADING = -0.20944;
/** How far the plane flies on take-off before it's gone, in font units. */
const FLY = 700;
/** The wipe that draws the trail starts this far behind the tail and ends this far past the head. */
const PAD = 30;

/** Width over height. */
export const LOADER_ASPECT = (FRAME.x1 - FRAME.x0) / (FRAME.y1 - FRAME.y0);

/** One beat of the loader, in ms. The draw matches the launch screen's (900ms, ease out); so does the take-off. */
export const LOADER_TIMING = { draw: 900, hold: 250, leave: 640, rest: 200, breathe: 800 } as const;

export function TrailLoader({
  size = 24,
  color,
  label = 'Loading',
  decorative = false,
  style,
  testID = 'trail-loader',
}: {
  /** The loader's height in points. */
  size?: number;
  /** One color for the whole t, for use on a filled button. Otherwise the stem is gray and the trail blue. */
  color?: string;
  label?: string;
  /** Set when the words beside it already say what's loading, so VoiceOver doesn't hear it twice. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useColors();
  const { reduce, known } = useReduceMotionStatus();
  const draw = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!known) return;
    draw.setValue(reduce ? 1 : 0);
    leave.setValue(0);
    breathe.setValue(1);
    const loop = reduce
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(breathe, {
              toValue: 0.45,
              duration: LOADER_TIMING.breathe,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(breathe, {
              toValue: 1,
              duration: LOADER_TIMING.breathe,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        )
      : Animated.loop(
          Animated.sequence([
            Animated.timing(draw, {
              toValue: 1,
              duration: LOADER_TIMING.draw,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.delay(LOADER_TIMING.hold),
            Animated.timing(leave, {
              toValue: 1,
              duration: LOADER_TIMING.leave,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.delay(LOADER_TIMING.rest),
          ]),
        );
    loop.start();
    return () => loop.stop();
  }, [known, reduce, draw, leave, breathe]);

  const k = size / (FRAME.y1 - FRAME.y0);
  const width = Math.round(size * LOADER_ASPECT * 10) / 10;
  const box = { width, height: size };
  const trailTint = color ?? c.accent;
  const stemTint = color ?? c.muted;

  // The window that opens left to right over the trail, so it looks drawn behind the plane.
  const winLeft = (TAIL.x - PAD - FRAME.x0) * k;
  const span = (HEAD.x - TAIL.x + 2 * PAD) * k;
  const runX = (HEAD.x - TAIL.x) * k;
  const runY = (HEAD.y - TAIL.y) * k;
  const flyX = FLY * Math.cos(HEADING) * k;
  const flyY = FLY * Math.sin(HEADING) * k;
  const gone = leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      style={[box, styles.clip, { opacity: breathe }, style]}
      pointerEvents="none"
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : label}
      accessibilityState={decorative ? undefined : { busy: true }}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      testID={testID}>
      <Image source={STEM} style={[styles.layer, box, { tintColor: stemTint }]} />
      <Animated.View style={[styles.layer, box, { opacity: gone }]}>
        <Animated.View
          style={[
            styles.window,
            {
              left: winLeft,
              width: span,
              height: size,
              transform: [{ translateX: draw.interpolate({ inputRange: [0, 1], outputRange: [-span, 0] }) }],
            },
          ]}
          testID="trail-loader-wipe">
          <Animated.View
            style={{
              position: 'absolute',
              left: -winLeft,
              top: 0,
              ...box,
              transform: [{ translateX: draw.interpolate({ inputRange: [0, 1], outputRange: [span, 0] }) }],
            }}>
            <Image source={TRAIL} style={[box, { tintColor: trailTint }]} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={[
          styles.layer,
          box,
          {
            opacity: Animated.multiply(draw.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }), gone),
            transform: [
              {
                translateX: Animated.add(
                  draw.interpolate({ inputRange: [0, 1], outputRange: [0, runX] }),
                  Animated.multiply(leave, flyX),
                ),
              },
              {
                translateY: Animated.add(
                  draw.interpolate({ inputRange: [0, 1], outputRange: [0, runY] }),
                  Animated.multiply(leave, flyY),
                ),
              },
            ],
          },
        ]}
        testID="trail-loader-plane">
        <Image source={PLANE} style={[box, { tintColor: trailTint }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, top: 0 },
  window: { position: 'absolute', top: 0, overflow: 'hidden' },
});
