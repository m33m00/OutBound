/**
 * GlobeMap: the only map component screens use.
 *
 * Layers (back to front):
 *   base picture   static globe, cached per camera (staticLayer.ts)
 *   night picture  day/night shading + sun highlight (item 11), one shader
 *                  draw; re-recorded on camera, size, scheme or when the sun
 *                  moved 0.1 deg (nightLayer.ts)
 *   radar picture  NOAA radar meshes (item 14); own layer, re-recorded on
 *                  camera, size, scheme or radar frame change (radarLayer.ts)
 *   route picture  arcs; re-recorded on camera, routes, selection or theme
 *                  change, never touching the static pictures (routeLayer.ts)
 *   rim picture    limb and edge, cached per camera
 *   marks picture  home pins, origin dot, destination rings, labels (item 9),
 *                  airport status badges (item 7) and the selected route's
 *                  leg flight-time pills (item 15); above the rim so the
 *                  limb never dims a label
 *   legend         React Native view, only while a route is selected
 *
 * Item 11 also adds the launch spin-in (spinIn.ts). The flight preview was
 * removed on 2026-10-30 (John: the app doesn't need it). Round 30 adds
 * flick-to-spin and the slow drift back home (momentum.ts).
 *
 * Gestures run on the JS thread (d3 projection and picture recording live
 * there): pan rotates (and, let go, flows back home), pinch zooms, a
 * tap (no movement) selects a route or clears the selection. Camera targets
 * fly (flyTo.ts) unless Reduce Motion is on, then they jump.
 */
import { Canvas, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
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
import { easeCubicInOut, interpolateCamera, planRetarget, sameCamera, type RunningFlight } from './flyTo';
import {
  DRIFT_HOME,
  momentumStep,
  planSettle,
  releaseVelocity,
  settleAt,
  shouldDriftHome,
  type Velocity,
} from './momentum';
import { routeFrameTarget } from './framing';
import { globeColors } from './globeColors';
import { hitTestRoutes } from './hitTest';
import { RouteLegend } from './RouteLegend';
import { recordRouteLayer, type RouteLayer } from './routeLayer';
import { drawnRoutes, nextSelection, routeSpokenName } from './routeModel';
import { recordBaseLayer, recordRimLayer } from './staticLayer';
import { canvasLayerOrder, RADAR, radarKey, radarSummary, type CanvasLayerName } from './radar';
import { makeRadarImageCache, recordRadarLayer } from './radarLayer';
import type { CameraTarget, GlobeMapProps, RouteLine } from './types';
import { useReduceMotionStatus } from './useReduceMotion';
import { recordNightLayer } from './nightLayer';
import { markSpinInDone, shouldSpinIn, SPIN_IN, spinStartCamera } from './spinIn';
import { NIGHT_THEME, SKY_IDLE_TICK_MS, sunFromKey, sunKey, sunPosition } from './sun';
import { makeLiftedProjector } from './arcs';
import { useLegTimeFont, useMarkFonts } from './markFonts';
import { legTimeColors, legTimeSpecs, legTimesSummary } from './legTimes';
import { markColors, marksSummary, markSet } from './marks';
import { recordMarksLayer } from './marksLayer';
import type { Box } from './marks';
import { statusColors, statusSet, statusSummary } from './status';

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
  homeAirports,
  origin,
  destinations,
  airportStatus,
  radar,
  cameraTarget,
  home,
  insets,
  interactive = true,
  showLegend = true,
  style,
}: GlobeMapProps) {
  const palette = useColors();
  const scheme = useColorSchemeName();
  const colors = useMemo(() => globeColors(scheme, palette), [scheme, palette]);
  const { reduce: reduceMotion, known: reduceKnown } = useReduceMotionStatus();
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
  /** Where the running flight ends, when it ends (performance clock), and if it is the spin-in. */
  const flightTargetRef = useRef<RunningFlight | null>(null);
  const commit = useCallback((next: GlobeCamera) => {
    cameraRef.current = next;
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setCamera(cameraRef.current);
    });
  }, []);
  /**
   * Stop a running flight where it is. With `snapSpin`, a running spin-in
   * jumps to where it was heading instead (its raised, small globe must not
   * stay on screen after a touch).
   */
  const stopFlight = useCallback((snapSpin = false) => {
    if (flightRef.current == null) return;
    cancelAnimationFrame(flightRef.current);
    flightRef.current = null;
    const target = flightTargetRef.current;
    flightTargetRef.current = null;
    if (snapSpin && target?.spin) {
      cameraRef.current = target.to;
      setCamera(target.to);
    }
    setFlying(false);
  }, []);
  // Coasting or settling home after a drag, and the timer that sends the
  // globe home after a pinch (momentum.ts).
  const coastRef = useRef<number | null>(null);
  const driftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopCoast = useCallback(() => {
    if (coastRef.current == null) return;
    cancelAnimationFrame(coastRef.current);
    coastRef.current = null;
    setMoving(false);
  }, []);
  const cancelDrift = useCallback(() => {
    if (driftTimer.current == null) return;
    clearTimeout(driftTimer.current);
    driftTimer.current = null;
  }, []);
  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      if (flightRef.current != null) cancelAnimationFrame(flightRef.current);
      if (coastRef.current != null) cancelAnimationFrame(coastRef.current);
      if (driftTimer.current != null) clearTimeout(driftTimer.current);
    },
    [],
  );

  const flyTo = useCallback((to: GlobeCamera, durationMs: number, spin = false) => {
    const from = cameraRef.current;
    if (!from) return;
    let t0: number | null = null;
    setFlying(true);
    flightTargetRef.current = { to, endsAt: performance.now() + durationMs, spin };
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
        flightTargetRef.current = null;
        setFlying(false);
      }
    };
    flightRef.current = requestAnimationFrame(step);
  }, []);

  // Target: the screen's, or the map's own framing (selected route, else
  // overview, else home).
  // Keyed by value, so a new array for the same spot doesn't count as a move.
  const homeLon = home?.[0];
  const homeLat = home?.[1];
  const autoTarget = useMemo(
    () => routeFrameTarget(routes, selectedId, homeLon != null && homeLat != null ? [homeLon, homeLat] : null),
    [routes, selectedId, homeLon, homeLat],
  );
  const targetKey = JSON.stringify(cameraTarget ?? autoTarget);
  const lastTargetKey = useRef<string | null>(null);
  // What the drift home reads when its timer fires (it outlives renders).
  const restRef = useRef({ targetKey, viewport, routeOpen: selectedId != null });
  useEffect(() => {
    restRef.current = { targetKey, viewport, routeOpen: selectedId != null };
  }, [targetKey, viewport, selectedId]);
  useEffect(() => {
    // Wait for Reduce Motion to be known so the spin-in never flashes.
    if (!viewport || !reduceKnown) return;
    const target = JSON.parse(targetKey) as CameraTarget;
    const next = cameraForTarget(target, viewport, cameraRef.current);
    // A new target flies; a layout or inset change re-frames (gliding with the panel, flyTo.ts).
    const isNewTarget = lastTargetKey.current !== targetKey;
    const wasCenter = lastTargetKey.current != null && (JSON.parse(lastTargetKey.current) as CameraTarget).kind === 'center';
    lastTargetKey.current = targetKey;
    // The camera is being placed (results, a pick, your location, the panel):
    // no coasting or pending drift from before.
    stopCoast();
    cancelDrift();

    // First camera: launch spin-in (once per app launch, item 11).
    if (!cameraRef.current) {
      const spin = shouldSpinIn({ reduceMotion: reduceRef.current, ...viewport });
      markSpinInDone();
      if (spin) {
        const start = spinStartCamera(next, viewport);
        cameraRef.current = start;
        setCamera(start);
        flyTo(next, SPIN_IN.durationMs, true);
        return;
      }
      cameraRef.current = next;
      setCamera(next);
      return;
    }

    // A new target (selection, deselect, fit) cancels a running spin-in and
    // flies from where it is; a re-frame mid-flight keeps flying (flyTo.ts).
    const plan = planRetarget({
      isNewTarget,
      homeOnly: wasCenter && target.kind === 'center',
      from: cameraRef.current,
      to: next,
      running: flightTargetRef.current,
      reduceMotion: reduceRef.current,
      nowMs: performance.now(),
    });
    stopFlight();
    if (plan.kind === 'jump') {
      cameraRef.current = next;
      setCamera(next);
    } else {
      flyTo(next, plan.durationMs, plan.spin);
    }
  }, [targetKey, viewport, reduceKnown, flyTo, stopFlight, stopCoast, cancelDrift]);

  // After a pinch (or any release under Reduce Motion), once the globe has
  // been still for a while, glide it slowly back home; never with a route
  // open (momentum.ts). Reduce Motion: a plain jump.
  const scheduleDrift = useCallback(() => {
    cancelDrift();
    driftTimer.current = setTimeout(() => {
      driftTimer.current = null;
      const { targetKey: key, viewport: vp, routeOpen } = restRef.current;
      const cur = cameraRef.current;
      if (!vp || !cur || flightRef.current != null || coastRef.current != null) return;
      const homeCam = cameraForTarget(JSON.parse(key) as CameraTarget, vp, cur);
      if (!shouldDriftHome({ routeOpen, atHome: sameCamera(cur, homeCam) })) return;
      if (reduceRef.current) {
        cameraRef.current = homeCam;
        setCamera(homeCam);
      } else {
        flyTo(homeCam, DRIFT_HOME.durationMs);
      }
    }, DRIFT_HOME.delayMs);
  }, [cancelDrift, flyTo]);

  // Let go of a drag with no route open: keep the finger's speed, slow down
  // and land on home in one motion (John: no stop, then reset). With a route
  // open: coast to a stop and stay. A pinch, a tap or Reduce Motion: no
  // coasting, just the drift timer.
  const coast = useCallback(
    (vx: number, vy: number, settle = false) => {
      stopCoast();
      const { targetKey: key, viewport: vp, routeOpen } = restRef.current;
      const start = cameraRef.current;
      if (settle && !routeOpen && !reduceRef.current && vp && start) {
        cancelDrift();
        const plan = planSettle(start, cameraForTarget(JSON.parse(key) as CameraTarget, vp, start), { x: vx, y: vy });
        if (!plan) return;
        setMoving(true);
        let t0: number | null = null;
        const settleStep = (now: number) => {
          if (t0 == null) t0 = now;
          const res = settleAt(plan, now - t0);
          cameraRef.current = res.camera;
          setCamera(res.camera);
          if (res.done) {
            coastRef.current = null;
            setMoving(false);
          } else {
            coastRef.current = requestAnimationFrame(settleStep);
          }
        };
        coastRef.current = requestAnimationFrame(settleStep);
        return;
      }
      let velocity: Velocity | null = releaseVelocity(vx, vy, reduceRef.current);
      if (!velocity || !cameraRef.current) {
        scheduleDrift();
        return;
      }
      setMoving(true);
      let last: number | null = null;
      const step = (now: number) => {
        const cur = cameraRef.current;
        if (!cur || !velocity) return;
        const res = momentumStep(cur, velocity, last == null ? 16 : now - last);
        last = now;
        velocity = res.velocity;
        cameraRef.current = res.camera;
        setCamera(res.camera);
        if (res.done) {
          coastRef.current = null;
          setMoving(false);
          scheduleDrift();
        } else {
          coastRef.current = requestAnimationFrame(step);
        }
      };
      coastRef.current = requestAnimationFrame(step);
    },
    [stopCoast, scheduleDrift, cancelDrift],
  );

  // Reduce Motion switched on mid-flight (or the spin-in): jump to the end.
  useEffect(() => {
    if (!reduceMotion) return;
    const running = flightTargetRef.current;
    if (!running) return;
    stopFlight();
    cameraRef.current = running.to;
    setCamera(running.to);
  }, [reduceMotion, stopFlight]);

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

  // Marks (item 9): dynamic like routes, not part of the cached globe. Props
  // are keyed by value so a new array with the same airports re-records nothing.
  const fonts = useMarkFonts();
  const markColorSet = useMemo(() => markColors(scheme, palette), [scheme, palette]);
  const airportsKey = JSON.stringify([homeAirports ?? [], origin ?? null, destinations ?? []]);
  const marks = useMemo(() => {
    const [h, o, d] = JSON.parse(airportsKey) as [
      NonNullable<typeof homeAirports>,
      typeof origin,
      NonNullable<typeof destinations>,
    ];
    return markSet({ homeAirports: h, origin: o, destinations: d, selectedRoute });
  }, [airportsKey, selectedRoute]);
  const marksSpoken = useMemo(() => {
    const [h, o, d] = JSON.parse(airportsKey);
    return marksSummary({ homeAirports: h, origin: o, destinations: d });
  }, [airportsKey]);
  // Airport status (item 7): badges ride on the marks, so they share the picture.
  const statusKey = JSON.stringify(airportStatus ?? []);
  const statuses = useMemo(
    () => statusSet(JSON.parse(statusKey) as NonNullable<typeof airportStatus>, marks, selectedRoute),
    [statusKey, marks, selectedRoute],
  );
  const statusSpoken = useMemo(() => statusSummary(JSON.parse(statusKey)), [statusKey]);
  const statusColorSet = useMemo(() => statusColors(palette), [palette]);
  // Leg flight-time pills (item 15): selected route only, kept off the
  // legend (measured below).
  const legTimeFont = useLegTimeFont();
  const legTimeColorSet = useMemo(() => legTimeColors(palette), [palette]);
  const [legendBox, setLegendBox] = useState<Box | null>(null);
  const onLegendLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width: w, height: h } = e.nativeEvent.layout;
    setLegendBox((prev) =>
      prev && prev.x0 === x && prev.y0 === y && prev.x1 === x + w && prev.y1 === y + h
        ? prev
        : { x0: x, y0: y, x1: x + w, y1: y + h },
    );
  }, []);
  const legendShown = showLegend && selectedRoute != null;
  const legTimesSpoken = useMemo(() => legTimesSummary(selectedRoute), [selectedRoute]);

  // Radar (item 14): decoded once per region + observedAt, drawn as its own
  // picture between the static base and the routes. Not used for hit tests.
  const radarCache = useRef<ReturnType<typeof makeRadarImageCache> | null>(null);
  if (!radarCache.current) radarCache.current = makeRadarImageCache();
  const radarLayersKey = radarKey(radar);
  const [radarEpoch, setRadarEpoch] = useState(0);
  const radarImages = useMemo(
    () => radarCache.current!.sync(radarLayersKey ? radar : undefined),
    // Keyed by value (region + observedAt + bbox): a new array with the
    // same frames neither decodes nor re-records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [radarLayersKey, radarEpoch],
  );
  const radarCleared = useRef(false);
  useEffect(() => {
    // Remount after an unmount cleanup (dev Strict Mode): decode again.
    if (radarCleared.current) {
      radarCleared.current = false;
      setRadarEpoch((e) => e + 1);
    }
    const cache = radarCache.current;
    return () => {
      cache?.clear();
      radarCleared.current = true;
    };
  }, []);
  const radarPicture = useMemo(() => {
    if (!viewport || !camera || radarImages.length === 0) return null;
    return recordRadarLayer({ camera, viewport, layers: radarImages, opacity: RADAR.opacity[scheme] });
  }, [camera, viewport, radarImages, scheme]);

  const legTimes = useMemo(() => legTimeSpecs(selectedRoute), [selectedRoute]);
  const marksPicture = useMemo(() => {
    if (!viewport || !camera || (marks.length === 0 && statuses.length === 0 && legTimes.length === 0)) return null;
    return recordMarksLayer({
      project: makeLiftedProjector(camera, viewport),
      viewport,
      marks,
      colors: markColorSet,
      fonts,
      statuses,
      statusColors: statusColorSet,
      legTimes,
      selectedRoute,
      legTimeFont,
      legTimeColors: legTimeColorSet,
      legendBox: legendShown ? legendBox : null,
    });
  }, [
    camera,
    viewport,
    marks,
    markColorSet,
    fonts,
    statuses,
    statusColorSet,
    legTimes,
    selectedRoute,
    legTimeFont,
    legTimeColorSet,
    legendShown,
    legendBox,
  ]);
  const radarSpoken = radarSummary(radarImages.length);

  // Day/night (item 11): real time, ticking at most once a minute (and on
  // return to the foreground).
  const [clockMs, setClockMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClockMs(Date.now()), SKY_IDLE_TICK_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setClockMs(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  // Keyed on the sun rounded to 0.1 deg, so a clock tick that does not move
  // the sun that far re-records nothing.
  const skyKey = sunKey(sunPosition(clockMs));
  const nightPicture = useMemo(() => {
    if (!viewport || !camera) return null;
    return recordNightLayer({ camera, viewport, sun: sunFromKey(skyKey), theme: NIGHT_THEME[scheme] });
  }, [camera, viewport, skyKey, scheme]);

  // Any touch on the map stops the spin-in (snapping to its end), a coast
  // and a pending drift home.
  const onTouchDown = useCallback(() => {
    if (flightTargetRef.current?.spin) stopFlight(true);
    stopCoast();
    cancelDrift();
  }, [stopFlight, stopCoast, cancelDrift]);
  const touchRef = useRef(onTouchDown);
  useEffect(() => {
    touchRef.current = onTouchDown;
  }, [onTouchDown]);

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

  const coastRef2 = useRef(coast);
  useEffect(() => {
    coastRef2.current = coast;
  }, [coast]);
  const active = useRef(0);
  const panStart = useRef<GlobeCamera | null>(null);
  const pinchStart = useRef(0);
  const width = size?.width ?? 0;
  const gesture = useMemo(() => {
    const begin = () => {
      touchRef.current();
      stopFlight();
      active.current += 1;
      setMoving(true);
    };
    const end = () => {
      active.current = Math.max(0, active.current - 1);
      if (active.current === 0) setMoving(false);
    };
    // Last finger up: a drag flows home with its speed; a pinch waits to drift.
    const release = (vx: number, vy: number, settle: boolean) => {
      if (active.current === 0) coastRef2.current(vx, vy, settle);
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
      .onFinalize((e) => {
        const started = panStart.current != null;
        panStart.current = null;
        if (!started) return;
        end();
        release(e.velocityX, e.velocityY, true);
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
        const started = pinchStart.current > 0;
        pinchStart.current = 0;
        if (!started) return;
        end();
        release(0, 0, false);
      });
    // A tap only fires if the finger stayed within TAP_SLOP and no drag/pinch
    // won the race, so a pan never ends in a tap.
    const tap = Gesture.Tap()
      .runOnJS(true)
      .enabled(interactive)
      .maxDistance(TAP_SLOP)
      .maxDuration(TAP_MAX_MS)
      .onBegin(() => touchRef.current())
      .onEnd((e, success) => {
        if (!success || active.current > 0) return;
        tapRef.current(e.x, e.y);
      })
      // A touch cancelled the drift; a tap that left the globe off home re-arms it.
      .onFinalize(() => {
        if (active.current === 0 && coastRef.current == null) coastRef2.current(0, 0);
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
          onTouchStart={onTouchDown}
          accessible
          accessibilityRole={hasRoutes ? 'adjustable' : 'image'}
          accessibilityLabel={[
            hasRoutes ? `Globe map, ${drawn.length} routes.` : 'Globe map.',
            marksSpoken,
            statusSpoken,
            radarSpoken,
          ]
            .filter(Boolean)
            .join(' ')}
          accessibilityValue={
            hasRoutes
              ? {
                  text: selectedRoute
                    ? [`Selected ${routeSpokenName(selectedRoute)}.`, legTimesSpoken].filter(Boolean).join(' ')
                    : 'No route selected',
                }
              : undefined
          }
          accessibilityHint={hasRoutes ? 'Swipe up or down to pick a route.' : undefined}
          accessibilityActions={a11yActions}
          onAccessibilityAction={onA11yAction}>
          {layers ? (
            <Canvas style={styles.fill}>
              {canvasLayerOrder({
                night: nightPicture != null,
                radar: radarPicture != null,
                routes: routeLayer != null,
                marks: marksPicture != null,
              }).map((name: CanvasLayerName) => {
                const picture = {
                  base: layers.base,
                  night: nightPicture,
                  radar: radarPicture,
                  routes: routeLayer?.picture,
                  rim: layers.rim,
                  marks: marksPicture,
                }[name];
                return picture ? <Picture key={name} picture={picture} /> : null;
              })}
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      {legendShown ? (
        <View
          onLayout={onLegendLayout}
          pointerEvents="none"
          style={[
            styles.legend,
            { left: normInsets.left + LEGEND_GAP, bottom: normInsets.bottom + LEGEND_GAP },
          ]}>
          <RouteLegend route={selectedRoute!} />
        </View>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  legend: { position: 'absolute' },
});
