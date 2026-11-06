import { Canvas, Circle, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { fonts } from '@/theme';
import { useReducedMotion } from '@/ui/useReducedMotion';

import {
  COLORS,
  exitPlan,
  ICON,
  introFrame,
  introLayout,
  planePolygon,
  REDUCED_INTRO_MS,
  skipTo,
  TIMING,
  type IntroFrame,
} from './introMotion';

/** The route as a Skia path, built once (it never changes, only how much of it shows). */
function makeRoutePath(): SkPath | null {
  const { start: s, c1, c2, end: e } = ICON;
  return Skia.Path.MakeFromSVGString(`M${s.x} ${s.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`);
}

function makePlanePath(frame: IntroFrame): SkPath {
  const pts = planePolygon(frame.plane.at, frame.plane.heading).map((pt) => Skia.Point(pt.x, pt.y));
  return Skia.Path.Polygon(pts, true);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** When the JS-drawn part ends and the native exit takes over, in ms. */
const exitAt = (reduceMotion: boolean) => (reduceMotion ? TIMING.reducedHold : TIMING.exit.start);

/**
 * The animated loading screen shown over the app when it opens (App Store round 1). It sits on top
 * of the real first screen, which loads underneath, so it never makes anyone wait longer than the
 * animation. Tap anywhere to skip to the take-off. Reduce Motion shows the finished mark and fades.
 *
 * The drawing (dot, route, split-flap letters) runs on the JS thread with a timer and plain Skia
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
  const route = useMemo(makeRoutePath, []);
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
  const origin = {
    x: lerp(layout.originFrom.x, layout.originTo.x, f.settle),
    y: lerp(layout.originFrom.y, layout.originTo.y, f.settle),
  };
  const s = layout.scale;
  const plane = f.plane.opacity > 0 ? makePlanePath(f) : null;
  const group = [{ translateX: origin.x }, { translateY: origin.y }, { scale: s }];

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
        accessibilityLabel="OutBound"
        accessibilityHint="Tap to skip">
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group transform={group}>
            {route && f.drawn > 0 ? (
              <Path path={route} style="stroke" strokeWidth={ICON.stroke} strokeCap="round" color={COLORS.white} end={f.drawn} />
            ) : null}
            <Circle cx={ICON.start.x} cy={ICON.start.y} r={ICON.ring * f.dot} color={COLORS.white} />
            <Circle cx={ICON.start.x} cy={ICON.start.y} r={ICON.dot * f.dot} color={COLORS.amber} />
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

        <View style={[styles.word, { top: layout.wordTop, gap: layout.tileGap, opacity: f.wordOpacity }]} pointerEvents="none">
          {f.letters.map((l, i) => (
            <View key={i} style={[styles.tile, { width: layout.tileW, height: layout.tileH, transform: [{ scaleY: l.flip }] }]}>
              <Text allowFontScaling={false} style={[styles.letter, { fontSize: layout.tileH * 0.72, lineHeight: layout.tileH }]}>
                {l.char}
              </Text>
              <View style={styles.shine} />
              <View style={styles.hinge} />
            </View>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: COLORS.panel },
  word: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  tile: {
    backgroundColor: COLORS.tile,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: { color: COLORS.white, fontFamily: fonts.brand, textAlign: 'center' },
  shine: { position: 'absolute', left: 0, right: 0, top: 0, height: '50%', backgroundColor: COLORS.tileShine },
  hinge: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, marginTop: -0.5, backgroundColor: COLORS.tileEdge },
});
