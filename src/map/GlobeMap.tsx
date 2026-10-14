/**
 * GlobeMap: the only map component screens use.
 *
 * Layers (back to front):
 *   base picture   static globe, cached per camera (staticLayer.ts)
 *   route picture  arcs; re-recorded on camera, routes, selection or theme
 *                  change, never touching the static pictures (routeLayer.ts)
 *   rim picture    limb and edge, cached per camera
 *   legend         React Native view, only while a route is selected
 *
 * Gestures run on the JS thread (d3 projection and picture recording live
 * there): pan rotates, pinch zooms, a tap (no movement) selects a route or
 * clears the selection. Camera targets fly (flyTo.ts) unless Reduce Motion
 * is on, then they jump.
 */
import { Canvas, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColors, useColorSchemeName } from '@/theme';

import {
  cameraForTarget,
  normalizeInsets,
  panCamera,
  pinchCamera,
  type GlobeCamera,
  type Viewport,
} from './camera';
import { easeCubicInOut, interpolateCamera, planCameraMove } from './flyTo';
import { routeFrameTarget } from './framing';
import { globeColors } from './globeColors';
import { hitTestRoutes } from './hitTest';
import { RouteLegend } from './RouteLegend';
import { recordRouteLayer, type RouteLayer } from './routeLayer';
import { drawnRoutes, nextSelection, routeSpokenName } from './routeModel';
import { recordBaseLayer, recordRimLayer } from './staticLayer';
import type { CameraTarget, GlobeMapProps, RouteLine } from './types';
import { useReduceMotion } from './useReduceMotion';

const NO_ROUTES: readonly RouteLine[] = [];
/** Finger travel that turns a touch into a drag instead of a tap (prototype: 6). */
const TAP_SLOP = 6;
/** Longer presses are not taps (prototype: 350 ms). */
const TAP_MAX_MS = 350;
/** Legend offset from the visible area's corner. */
const LEGEND_GAP = 12;

export function GlobeMap({
  routes = NO_ROUTES,
  selectedRouteId,
  onSelectRoute,
  cameraTarget,
  insets,
  interactive = true,
  showLegend = true,
  style,
}: GlobeMapProps) {
  const palette = useColors();
  const scheme = useColorSchemeName();
  const colors = useMemo(() => globeColors(scheme, palette), [scheme, palette]);
  const reduceMotion = useReduceMotion();
  const reduceRef = useRef(reduceMotion);
  useEffect(() => {
    reduceRef.current = reduceMotion;
  }, [reduceMotion]);

  // Selection: controlled when the prop is not undefined, else internal.
  const [ownSelected, setOwnSelected] = useState<string | null>(null);
  const controlled = selectedRouteId !== undefined;
  const wanted = controlled ? selectedRouteId : ownSelected;
  const selectedId = wanted != null && routes.some((r) => r.id === wanted) ? wanted : null;
  const drawn = useMemo(() => drawnRoutes(routes, selectedId), [routes, selectedId]);
  const selectedRoute = selectedId ? drawn.find((r) => r.id === selectedId) : undefined;

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [camera, setCamera] = useState<GlobeCamera | null>(null);
  const [moving, setMoving] = useState(false);
  const [flying, setFlying] = useState(false);

  const normInsets = normalizeInsets(insets);
  const insetKey = JSON.stringify(normInsets);
  const viewport = useMemo<Viewport | null>(
    () => (size ? { ...size, insets: JSON.parse(insetKey) } : null),
    [size, insetKey],
  );

  // Latest camera for gesture math; React state follows at most once per frame.
  const cameraRef = useRef<GlobeCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const flightRef = useRef<number | null>(null);
  const commit = useCallback((next: GlobeCamera) => {
    cameraRef.current = next;
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setCamera(cameraRef.current);
    });
  }, []);
  const stopFlight = useCallback(() => {
    if (flightRef.current == null) return;
    cancelAnimationFrame(flightRef.current);
    flightRef.current = null;
    setFlying(false);
  }, []);
  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      if (flightRef.current != null) cancelAnimationFrame(flightRef.current);
    },
    [],
  );

  const flyTo = useCallback((to: GlobeCamera, durationMs: number) => {
    const from = cameraRef.current;
    if (!from) return;
    let t0: number | null = null;
    setFlying(true);
    const step = (now: number) => {
      if (t0 == null) t0 = now;
      const t = Math.min(1, (now - t0) / durationMs);
      const cam = interpolateCamera(from, to, easeCubicInOut(t));
      cameraRef.current = cam;
      setCamera(cam);
      if (t < 1) {
        flightRef.current = requestAnimationFrame(step);
      } else {
        flightRef.current = null;
        setFlying(false);
      }
    };
    flightRef.current = requestAnimationFrame(step);
  }, []);

  // Target: the screen's, or the map's own framing (selected route, else overview).
  const autoTarget = useMemo(() => routeFrameTarget(routes, selectedId), [routes, selectedId]);
  const targetKey = JSON.stringify(cameraTarget ?? autoTarget);
  const lastTargetKey = useRef<string | null>(null);
  useEffect(() => {
    if (!viewport) return;
    const target = JSON.parse(targetKey) as CameraTarget;
    const next = cameraForTarget(target, viewport, cameraRef.current);
    // Only a new target flies; a layout or inset change just re-frames.
    const isNewTarget = lastTargetKey.current !== targetKey;
    lastTargetKey.current = targetKey;
    stopFlight();
    const plan = isNewTarget
      ? planCameraMove(cameraRef.current, next, reduceRef.current)
      : ({ animate: false } as const);
    if (plan.animate) {
      flyTo(next, plan.durationMs);
    } else {
      cameraRef.current = next;
      setCamera(next);
    }
  }, [targetKey, viewport, flyTo, stopFlight]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const select = useCallback(
    (id: string | null) => {
      if (!controlled) setOwnSelected(id);
      onSelectRoute?.(id);
    },
    [controlled, onSelectRoute],
  );

  // Cached static layers: re-recorded only on camera / size / theme / motion change.
  const fast = moving || flying;
  const layers = useMemo(() => {
    if (!viewport || !camera) return null;
    const input = { camera, viewport, colors, fast };
    return { base: recordBaseLayer(input), rim: recordRimLayer(input) };
  }, [camera, viewport, colors, fast]);

  // Dynamic route layer (+ hit lines). Selection changes re-record only this.
  const routeLayer = useMemo<RouteLayer | null>(() => {
    if (!viewport || !camera || drawn.length === 0) return null;
    return recordRouteLayer({
      camera,
      viewport,
      palette,
      scheme,
      routeShadow: colors.routeShadow,
      routeShadowAlpha: colors.routeShadowAlpha,
      routes: drawn,
      selectedId,
    });
  }, [camera, viewport, palette, scheme, colors, drawn, selectedId]);

  // Tap handling reads the latest render through a ref (gestures are memoized).
  const handleTap = useCallback(
    (x: number, y: number) => {
      const hit = hitTestRoutes({ x, y }, routeLayer?.hitLines ?? [], selectedId);
      const next = nextSelection(routes, selectedId, hit);
      if (next !== undefined) select(next);
    },
    [routeLayer, routes, selectedId, select],
  );
  const tapRef = useRef(handleTap);
  useEffect(() => {
    tapRef.current = handleTap;
  }, [handleTap]);

  const active = useRef(0);
  const panStart = useRef<GlobeCamera | null>(null);
  const pinchStart = useRef(0);
  const width = size?.width ?? 0;
  const gesture = useMemo(() => {
    const begin = () => {
      stopFlight();
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
      .minDistance(TAP_SLOP)
      .onStart(() => {
        // No camera yet (before first layout): skip, so begin/end stay paired.
        if (!cameraRef.current) return;
        begin();
        panStart.current = cameraRef.current;
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
        begin();
        pinchStart.current = cameraRef.current.radius;
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
    // A tap only fires if the finger stayed within TAP_SLOP and no drag/pinch
    // won the race, so a pan never ends in a tap.
    const tap = Gesture.Tap()
      .runOnJS(true)
      .enabled(interactive)
      .maxDistance(TAP_SLOP)
      .maxDuration(TAP_MAX_MS)
      .onEnd((e, success) => {
        if (!success || active.current > 0) return;
        tapRef.current(e.x, e.y);
      });
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [commit, interactive, width, stopFlight]);

  // Accessibility: the route list is the primary path; the map also lets
  // VoiceOver step through drawn routes (swipe up/down) and clear selection.
  const hasRoutes = drawn.length > 0;
  const onA11yAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (drawn.length === 0) return;
      const i = selectedId ? drawn.findIndex((r) => r.id === selectedId) : -1;
      if (e.nativeEvent.actionName === 'increment') {
        select(drawn[(i + 1) % drawn.length].id);
      } else if (e.nativeEvent.actionName === 'decrement') {
        select(drawn[i <= 0 ? drawn.length - 1 : i - 1].id);
      } else if (e.nativeEvent.actionName === 'clear' && selectedId) {
        select(null);
      }
    },
    [drawn, selectedId, select],
  );
  const a11yActions = hasRoutes
    ? [
        { name: 'increment', label: 'Next route' },
        { name: 'decrement', label: 'Previous route' },
        ...(selectedId ? [{ name: 'clear', label: 'Clear route selection' }] : []),
      ]
    : undefined;

  return (
    <GestureHandlerRootView style={[styles.fill, { backgroundColor: colors.space }, style]}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.fill}
          onLayout={onLayout}
          accessible
          accessibilityRole={hasRoutes ? 'adjustable' : 'image'}
          accessibilityLabel={hasRoutes ? `Globe map, ${drawn.length} routes` : 'Globe map'}
          accessibilityValue={
            hasRoutes
              ? { text: selectedRoute ? `Selected ${routeSpokenName(selectedRoute)}` : 'No route selected' }
              : undefined
          }
          accessibilityHint={hasRoutes ? 'Swipe up or down to pick a route.' : undefined}
          accessibilityActions={a11yActions}
          onAccessibilityAction={onA11yAction}>
          {layers ? (
            <Canvas style={styles.fill}>
              <Picture picture={layers.base} />
              {routeLayer ? <Picture picture={routeLayer.picture} /> : null}
              {/* Later: marks (item 9), airport status (item 7) between routes and rim. */}
              <Picture picture={layers.rim} />
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      {showLegend && selectedRoute ? (
        <View
          pointerEvents="none"
          style={[
            styles.legend,
            { left: normInsets.left + LEGEND_GAP, bottom: normInsets.bottom + LEGEND_GAP },
          ]}>
          <RouteLegend route={selectedRoute} />
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  legend: { position: 'absolute' },
});
