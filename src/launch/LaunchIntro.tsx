import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { planePolygon, polygonPath, trailPolygon } from '@/brand/geometry';
import { LETTERS } from '@/brand/jauntMark';
import { useReducedMotion } from '@/ui/useReducedMotion';

import { COLORS, exitPlan, introFrame, introLayout, REDUCED_INTRO_MS, skipTo, TIMING } from './introMotion';

/** When the JS-drawn part ends and the native exit takes over, in ms. */
const exitAt = (reduceMotion: boolean) => (reduceMotion ? TIMING.reducedHold : TIMING.exit.start);

/**
 * The animated loading screen shown over the app when it opens (App Store round 1). It sits on top
 * of the real first screen, which loads underneath, so it never makes anyone wait longer than the
 * animation. Tap anywhere to skip to the take-off. Reduce Motion shows the finished wordmark and fades.
 *
 * The drawing (letters rising in, the contrail drawing out) runs on the JS thread with a timer and plain Skia
 * props, no Reanimated, the same safe pattern as the route pulse after round 85's crash. At the
 * take-off the picture freezes and the plane's flight and the panel's lift run as native-driver
 * Animated timings (round 169), so they stay smooth while the app mounts underneath and keeps the
 * JS thread busy.
 */
export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [t, setT] = useState(0);
  const [exiting, setExiting] = useState(false);
  const offset = useRef(0);
  const layout = useMemo(() => introLayout(width, height), [width, height]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const fly = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const plan = useMemo(() => exitPlan(layout, introFrame(TIMING.exit.start).plane.heading, height), [layout, height]);

  useEffect(() => {
    let alive = true;
    let frame = 0;
    let exit: Animated.CompositeAnimation | null = null;
    const began = Date.now();
    const finish = () => {
      if (alive) doneRef.current();
    };
    const tick = () => {
      if (!alive) return;
      const now = Date.now() - began + offset.current;
      const at = exitAt(reduceMotion);
      if (now < at) {
        setT(now);
        frame = requestAnimationFrame(tick);
        return;
      }
      // Freeze on the take-off frame and hand the rest to the native thread.
      setT(at);
      setExiting(true);
      exit = reduceMotion
        ? Animated.timing(fade, { toValue: 0, duration: REDUCED_INTRO_MS - at, easing: Easing.linear, useNativeDriver: true })
        : Animated.parallel([
            Animated.timing(fly, { toValue: 1, duration: plan.flyMs, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(lift, {
              toValue: 1,
              delay: plan.liftDelay,
              duration: plan.liftMs,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]);
      exit.start(finish);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      exit?.stop();
    };
  }, [reduceMotion, fly, lift, fade, plan]);

  const f = introFrame(t, reduceMotion);
  const s = layout.scale;
  const group = [{ translateX: layout.origin.x }, { translateY: layout.origin.y }, { scale: s }];
  const trail = f.drawn > 0 ? polygonPath(trailPolygon(f.drawn)) : null;
  const plane = f.plane.opacity > 0 ? polygonPath(planePolygon(f.plane.at, f.plane.heading)) : null;

  const skip = () => {
    if (reduceMotion || exiting) return;
    offset.current += skipTo(t) - t;
  };

  return (
    <Animated.View
      testID="launch-intro"
      pointerEvents={exiting ? 'none' : 'auto'}
      style={[
        StyleSheet.absoluteFill,
        { opacity: fade, transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, plan.liftY] }) }] },
      ]}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.panel]}
        onPress={skip}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Jaunt"
        accessibilityHint="Tap to skip">
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group transform={group}>
            {LETTERS.map((d, i) =>
              f.letters[i].opacity > 0 ? (
                <Group key={i} transform={[{ translateY: f.letters[i].rise }]}>
                  <Path path={d} color={COLORS.white} opacity={f.letters[i].opacity} />
                </Group>
              ) : null,
            )}
            {trail ? <Path path={trail} color={COLORS.white} /> : null}
          </Group>
        </Canvas>

        {/* The plane on its own layer, so the take-off can move it without redrawing. */}
        <Animated.View
          testID="launch-plane"
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, plan.flyX] }) },
                { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, plan.flyY] }) },
              ],
            },
          ]}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Group transform={group}>{plane ? <Path path={plane} color={COLORS.white} opacity={f.plane.opacity} /> : null}</Group>
          </Canvas>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: COLORS.panel },
});
