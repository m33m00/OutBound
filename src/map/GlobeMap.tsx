/**
 * GlobeMap: the only map component screens use. Globe v1 (backlog item 2).
 *
 * Renders the cached static globe (two Skia Pictures) and handles drag to
 * rotate and pinch to zoom. Routes, selection, marks and airport status are
 * accepted as props and drawn in later items (4, 7, 9) in the dynamic slot
 * between the two pictures. v1 has no animation, so Reduce Motion needs no
 * special handling yet; fly-to (item 4) must jump instantly when it is on.
 */
import { Canvas, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColors, useColorSchemeName } from '@/theme';

import {
  cameraForTarget,
  defaultCamera,
  normalizeInsets,
  panCamera,
  pinchCamera,
  type GlobeCamera,
  type Viewport,
} from './camera';
import { globeColors } from './globeColors';
import { recordBaseLayer, recordRimLayer } from './staticLayer';
import type { GlobeMapProps } from './types';

export function GlobeMap({ cameraTarget, insets, interactive = true, style }: GlobeMapProps) {
  const palette = useColors();
  const scheme = useColorSchemeName();
  const colors = useMemo(() => globeColors(scheme, palette), [scheme, palette]);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [camera, setCamera] = useState<GlobeCamera | null>(null);
  const [moving, setMoving] = useState(false);

  const insetKey = JSON.stringify(normalizeInsets(insets));
  const viewport = useMemo<Viewport | null>(
    () => (size ? { ...size, insets: JSON.parse(insetKey) } : null),
    [size, insetKey],
  );

  // Latest camera for gesture math; React state follows at most once per frame.
  const cameraRef = useRef<GlobeCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const commit = useCallback((next: GlobeCamera) => {
    cameraRef.current = next;
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setCamera(cameraRef.current);
    });
  }, []);
  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // Apply the camera target when its value (or the viewport) changes.
  const targetKey = JSON.stringify(cameraTarget ?? null);
  useEffect(() => {
    if (!viewport) return;
    const target = JSON.parse(targetKey) as GlobeMapProps['cameraTarget'] | null;
    const next = target
      ? cameraForTarget(target, viewport, cameraRef.current)
      : (cameraRef.current ?? defaultCamera(viewport));
    cameraRef.current = next;
    setCamera(next);
  }, [targetKey, viewport]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  // Gestures run on the JS thread: d3 projection and picture recording live there.
  const active = useRef(0);
  const panStart = useRef<GlobeCamera | null>(null);
  const pinchStart = useRef(0);
  const width = size?.width ?? 0;
  const gesture = useMemo(() => {
    const begin = () => {
      active.current += 1;
      setMoving(true);
    };
    const end = () => {
      active.current = Math.max(0, active.current - 1);
      if (active.current === 0) setMoving(false);
    };
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(interactive)
      .onStart(() => {
        // No camera yet (before first layout): skip, so begin/end stay paired.
        if (!cameraRef.current) return;
        panStart.current = cameraRef.current;
        begin();
      })
      .onUpdate((e) => {
        const start = panStart.current;
        const cur = cameraRef.current;
        if (!start || !cur) return;
        const moved = panCamera(start, e.translationX, e.translationY);
        commit({ center: moved.center, radius: cur.radius });
      })
      .onFinalize(() => {
        if (panStart.current) end();
        panStart.current = null;
      });
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .enabled(interactive)
      .onStart(() => {
        if (!cameraRef.current) return;
        pinchStart.current = cameraRef.current.radius;
        begin();
      })
      .onUpdate((e) => {
        const cur = cameraRef.current;
        if (!cur || pinchStart.current <= 0) return;
        commit(pinchCamera(cur, pinchStart.current, e.scale, width));
      })
      .onFinalize(() => {
        if (pinchStart.current > 0) end();
        pinchStart.current = 0;
      });
    return Gesture.Simultaneous(pan, pinch);
  }, [commit, interactive, width]);

  // Cached static layers: re-recorded only on camera / size / theme / moving change.
  const layers = useMemo(() => {
    if (!viewport || !camera) return null;
    const input = { camera, viewport, colors, fast: moving };
    return { base: recordBaseLayer(input), rim: recordRimLayer(input) };
  }, [camera, viewport, colors, moving]);

  return (
    <GestureHandlerRootView style={[styles.fill, { backgroundColor: colors.space }, style]}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.fill}
          onLayout={onLayout}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Globe map">
          {layers ? (
            <Canvas style={styles.fill}>
              <Picture picture={layers.base} />
              {/* Dynamic slot: routes (item 4), marks (item 9), airport status (item 7). */}
              <Picture picture={layers.rim} />
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
