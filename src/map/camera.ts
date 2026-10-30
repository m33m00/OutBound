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
  /**
   * Vertical shift of the globe center from `globeOrigin`, in pt. Only the
   * launch spin-in (item 11) uses it; it is 0/undefined otherwise and
   * flies back to 0 with the spin.
   */
  offsetY?: number;
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

/** Screen point of the globe center for a camera (globeOrigin + offsetY). */
export function cameraOrigin(camera: GlobeCamera, vp: Viewport): { x: number; y: number } {
  const o = globeOrigin(vp);
  return camera.offsetY ? { x: o.x, y: o.y + camera.offsetY } : o;
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

/** Degrees the globe turns per pt of finger travel at this radius. */
export function dragDegreesPerPt(radius: number): number {
  return (180 / (Math.PI * radius)) * DRAG_GAIN;
}

/** Rotate by a drag of (dx, dy) pt from `start`. Drag right/down shows what is west/north. */
export function panCamera(start: GlobeCamera, dx: number, dy: number): GlobeCamera {
  const k = dragDegreesPerPt(start.radius);
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

/** Space kept between a fitted route box and the visible area's edges, in pt. */
export const FIT_PADDING = 32;

/** Screen box of `coords` on a unit orthographic globe centered on `center`. */
function unitBox(coords: readonly [number, number][], center: [number, number]) {
  const unit = geoOrthographic().rotate([-center[0], -center[1], 0]).scale(1).translate([0, 0]);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const c of coords) {
    const q = unit(c);
    if (!q) continue;
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  return Number.isFinite(x0) ? { unit, x0, x1, y0, y1 } : null;
}

/** Re-centering passes; the box center converges in 2-3 for real routes. */
const FIT_PASSES = 4;

/**
 * Camera that frames `points` inside the visible area (v9.1 prototype fitCam):
 * project the points around a center, measure the real screen box, center on
 * the box (not the centroid), and pick the radius that fits width and height
 * separately. Unlike the prototype, the re-centering is repeated: moving the
 * center changes the projected box, and a single pass can overflow the
 * padding by several points. Radius is clamped to the zoom limits.
 */
export function fitCameraToPoints(points: readonly LonLat[], vp: Viewport): GlobeCamera | null {
  if (points.length === 0) return null;
  const coords = points.map((p) => [p[0], p[1]] as [number, number]);
  const mid = geoCentroid({ type: 'MultiPoint', coordinates: coords });
  let center: [number, number] =
    Number.isFinite(mid[0]) && Number.isFinite(mid[1]) ? [mid[0], mid[1]] : coords[0];
  let box = unitBox(coords, center);
  if (!box) return null;
  for (let i = 0; i < FIT_PASSES; i++) {
    const c = box.unit.invert?.([(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2]);
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) break;
    const next = unitBox(coords, [c[0], c[1]]);
    if (!next) break;
    center = [c[0], c[1]];
    box = next;
  }
  const { width, height, insets } = vp;
  const visW = Math.max(1, width - insets.left - insets.right - 2 * FIT_PADDING);
  const visH = Math.max(1, height - insets.top - insets.bottom - 2 * FIT_PADDING);
  const dx = Math.max(0.004, box.x1 - box.x0);
  const dy = Math.max(0.004, box.y1 - box.y0);
  const radius = clampRadius(Math.min(visW / dx, visH / dy), width);
  return { center: [normalizeLon(center[0]), clampLat(center[1])], radius };
}

/** Camera for a target. 'fit' with no points keeps the current camera. */
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
  return fitCameraToPoints(target.points, vp) ?? current ?? defaultCamera(vp);
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
  const o = cameraOrigin(camera, vp);
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
