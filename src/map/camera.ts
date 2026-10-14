/**
 * Pure camera math for the orthographic globe (no Skia, no React).
 * Limits and drag speed come from reference/globe-prototype-v9.1.html
 * (lat clamp ±85, radius 0.42–6 × view width, 50m detail above 2.1 × width).
 */
import { geoCentroid, geoDistance, geoOrthographic, type GeoProjection } from 'd3-geo';

import type { CameraTarget, LonLat, MapInsets } from './types';

/** Internal camera: what the globe looks at and how big it is on screen. */
export interface GlobeCamera {
  center: LonLat;
  /** Sphere radius in pt. */
  radius: number;
}

export interface Viewport {
  width: number;
  height: number;
  insets: MapInsets;
}

export const LAT_LIMIT = 85;
export const MIN_RADIUS_FACTOR = 0.42;
export const MAX_RADIUS_FACTOR = 6;
export const HIGH_DETAIL_FACTOR = 2.1;
/** Prototype drag gain: a bit slower than finger-locked so it feels steady. */
const DRAG_GAIN = 0.95;
/** zoom 1 = sphere diameter is 90% of the smaller visible side. */
const FIT_FRACTION = 0.45;

/** Continental US; used until a screen passes a cameraTarget. */
export const DEFAULT_CENTER: LonLat = [-97, 38];

export const NO_INSETS: MapInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function normalizeInsets(insets?: Partial<MapInsets>): MapInsets {
  return { ...NO_INSETS, ...insets };
}

export function clampLat(lat: number): number {
  return Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, lat));
}

/** Wrap longitude into [-180, 180). */
export function normalizeLon(lon: number): number {
  if (lon >= -180 && lon < 180) return lon === 0 ? 0 : lon;
  const wrapped = (((lon + 180) % 360) + 360) % 360 - 180;
  return wrapped === -0 ? 0 : wrapped;
}

export function clampRadius(radius: number, width: number): number {
  return Math.max(width * MIN_RADIUS_FACTOR, Math.min(width * MAX_RADIUS_FACTOR, radius));
}

/** Screen point the globe center sits on: middle of the area not covered by insets. */
export function globeOrigin(vp: Viewport): { x: number; y: number } {
  const { width, height, insets } = vp;
  return {
    x: insets.left + Math.max(0, width - insets.left - insets.right) / 2,
    y: insets.top + Math.max(0, height - insets.top - insets.bottom) / 2,
  };
}

/** Radius for zoom 1 in this viewport. */
export function fitRadius(vp: Viewport): number {
  const visW = Math.max(1, vp.width - vp.insets.left - vp.insets.right);
  const visH = Math.max(1, vp.height - vp.insets.top - vp.insets.bottom);
  return clampRadius(Math.min(visW, visH) * FIT_FRACTION, vp.width);
}

export function defaultCamera(vp: Viewport): GlobeCamera {
  return { center: DEFAULT_CENTER, radius: fitRadius(vp) };
}

/** Rotate by a drag of (dx, dy) pt from `start`. Drag right/down shows what is west/north. */
export function panCamera(start: GlobeCamera, dx: number, dy: number): GlobeCamera {
  const k = (180 / (Math.PI * start.radius)) * DRAG_GAIN;
  return {
    center: [normalizeLon(start.center[0] - dx * k), clampLat(start.center[1] + dy * k)],
    radius: start.radius,
  };
}

/** Zoom by a pinch `scale` relative to `startRadius`, keeping the current center. */
export function pinchCamera(
  current: GlobeCamera,
  startRadius: number,
  scale: number,
  width: number,
): GlobeCamera {
  return { center: current.center, radius: clampRadius(startRadius * scale, width) };
}

/**
 * Camera for a target. 'fit' is a v1 stub: centroid of the points at the
 * current radius (real route-box fit and fly-to arrive in item 4).
 */
export function cameraForTarget(
  target: CameraTarget,
  vp: Viewport,
  current: GlobeCamera | null,
): GlobeCamera {
  if (target.kind === 'center') {
    const zoom = target.zoom ?? 1;
    return {
      center: [normalizeLon(target.center[0]), clampLat(target.center[1])],
      radius: clampRadius(fitRadius(vp) * zoom, vp.width),
    };
  }
  const radius = current?.radius ?? fitRadius(vp);
  if (target.points.length === 0) return current ?? defaultCamera(vp);
  const [lon, lat] = geoCentroid({
    type: 'MultiPoint',
    coordinates: target.points.map((p) => [p[0], p[1]]),
  });
  return { center: [normalizeLon(lon), clampLat(lat)], radius };
}

/** Use Natural Earth 50m instead of 110m once zoomed in this far. */
export function wantsHighDetail(camera: GlobeCamera, width: number): boolean {
  return camera.radius > width * HIGH_DETAIL_FACTOR;
}

/**
 * d3 orthographic projection for a camera. `fast` lowers precision while a
 * gesture is moving (prototype: 2 vs 0.4).
 */
export function projectionFor(camera: GlobeCamera, vp: Viewport, fast = false): GeoProjection {
  const o = globeOrigin(vp);
  return geoOrthographic()
    .rotate([-camera.center[0], -camera.center[1], 0])
    .scale(camera.radius)
    .translate([o.x, o.y])
    .clipAngle(90)
    .precision(fast ? 2 : 0.4);
}

/** True if the point is on the visible hemisphere. */
export function isOnFrontSide(camera: GlobeCamera, point: LonLat): boolean {
  return geoDistance([camera.center[0], camera.center[1]], [point[0], point[1]]) <= Math.PI / 2;
}
