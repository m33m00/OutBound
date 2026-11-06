import { Canvas, Circle, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { fonts } from '@/theme';
import { useReducedMotion } from '@/ui/useReducedMotion';

import { COLORS, ICON, introFrame, introLayout, planePolygon, skipTo, type IntroFrame } from './introMotion';

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

/**
 * The animated loading screen shown over the app when it opens (App Store round 1). It sits on top
 * of the real first screen, which loads underneath, so it never makes anyone wait longer than the
 * animation. Tap anywhere to skip to the take-off. Reduce Motion shows the finished mark and fades.
 *
 * Runs on the JS thread (a timer and plain Skia props, no Reanimated), the same safe pattern as the
 * route pulse after round 85's crash.
 */
export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [t, setT] = useState(0);
  const offset = useRef(0);
  const route = useMemo(makeRoutePath, []);
  const layout = useMemo(() => introLayout(width, height), [width, height]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let alive = true;
    let frame = 0;
    const began = Date.now();
    const tick = () => {
      if (!alive) return;
      const now = Date.now() - began + offset.current;
      setT(now);
      if (introFrame(now, reduceMotion).done) {
        alive = false;
        doneRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  const f = introFrame(t, reduceMotion);
  const origin = {
    x: lerp(layout.originFrom.x, layout.originTo.x, f.settle),
    y: lerp(layout.originFrom.y, layout.originTo.y, f.settle),
  };
  const s = layout.scale;
  const plane = f.plane.opacity > 0 ? makePlanePath(f) : null;

  const skip = () => {
    if (reduceMotion) return;
    offset.current += skipTo(t) - t;
  };

  return (
    <View
      testID="launch-intro"
      pointerEvents={f.lift > 0.3 || f.opacity < 0.7 ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, { opacity: f.opacity, transform: [{ translateY: -f.lift * (height + 40) }] }]}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.panel]}
        onPress={skip}
        accessible
        accessibilityRole="image"
        accessibilityLabel="OutBound"
        accessibilityHint="Tap to skip"
      >
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group transform={[{ translateX: origin.x }, { translateY: origin.y }, { scale: s }]}>
            {route && f.drawn > 0 ? (
              <Path path={route} style="stroke" strokeWidth={ICON.stroke} strokeCap="round" color={COLORS.white} end={f.drawn} />
            ) : null}
            {plane ? <Path path={plane} color={COLORS.white} opacity={f.plane.opacity} /> : null}
            <Circle cx={ICON.start.x} cy={ICON.start.y} r={ICON.ring * f.dot} color={COLORS.white} />
            <Circle cx={ICON.start.x} cy={ICON.start.y} r={ICON.dot * f.dot} color={COLORS.amber} />
          </Group>
        </Canvas>

        <View style={[styles.word, { top: layout.wordTop, gap: layout.tileGap, opacity: f.wordOpacity }]} pointerEvents="none">
          {f.letters.map((l, i) => (
            <View
              key={i}
              style={[
                styles.tile,
                { width: layout.tileW, height: layout.tileH, transform: [{ scaleY: l.flip }] },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.letter, { fontSize: layout.tileH * 0.72, lineHeight: layout.tileH }]}
              >
                {l.char}
              </Text>
              <View style={styles.shine} />
              <View style={styles.hinge} />
            </View>
          ))}
        </View>
      </Pressable>
    </View>
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
