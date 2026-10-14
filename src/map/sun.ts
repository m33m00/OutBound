/**
 * Day/night math (backlog item 11, Q-037). Pure: no Skia, no React.
 *
 * Follows sunPos and skyLayers in reference/globe-prototype-v9.1.html:
 * - sunPosition: low-precision solar ephemeris (about 0.01 deg in declination,
 *   well inside what a globe-sized terminator can show).
 * - nightAlpha: night = smoothstep of how far below the terminator a point is,
 *   plus a narrow Gaussian dusk band centered just past it.
 * The Skia side (nightLayer.ts) evaluates the same curve per pixel in a
 * RuntimeEffect shader built from the constants below, so the two never drift.
 *
 * No sun disc, no Day/Night labels, no city lights (John, Q-037).
 */
import type { ColorScheme } from '@/theme';
import { geoRotation } from 'd3-geo';

import type { GlobeCamera } from './camera';
import type { Rgb } from './globeColors';
import type { LonLat } from './types';

const RAD = Math.PI / 180;

/** Subsolar point [lon, lat] in degrees for a UTC time (epoch ms). */
export function sunPosition(utcMs: number): LonLat {
  const d = (utcMs - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const g = (357.529 + 0.98560028 * d) % 360;
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = q + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);
  const e = 23.439 - 0.00000036 * d;
  const ra = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) / RAD;
  const dec = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) / RAD;
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
  let lon = ra - gmst * 15;
  lon = ((((lon + 540) % 360) + 360) % 360) - 180;
  return [lon, dec];
}

/** Curve constants (prototype skyLayers). */
export const NIGHT = {
  /** Night starts fading in at this dot (sun slightly above the horizon)... */
  start: 0.1,
  /** ...and is full this far further toward the night side. */
  span: 0.44,
  /** The prototype scales the theme's night alpha by this. */
  alphaGain: 1.08,
  /** Dusk band: peak alpha, center offset and width (in dot units). */
  duskPeak: 0.13,
  duskCenter: -0.01,
  duskWidth: 0.075,
  /** Below this combined alpha nothing is drawn. */
  minAlpha: 0.004,
} as const;

/** Sun highlight on the lit side (prototype: white 0.16 -> 0 over 0.55 R). */
export const SUN_HIGHLIGHT = {
  alpha: 0.16,
  radius: 0.55,
  /**
   * Fade the highlight out as the subsolar point nears the limb, instead of
   * the prototype's hard on/off when it crosses (provisional; avoids a pop
   * while the preview moves the sun).
   */
  fadeZ: 0.15,
} as const;

export interface NightTheme {
  night: Rgb;
  /** Theme night alpha before alphaGain. */
  nightAlpha: number;
  dusk: Rgb;
}

/**
 * Prototype :root (light) and dark values. Dusk is scenery: a soft warm
 * band at low alpha, never the amber "you" color at strength.
 */
export const NIGHT_THEME: Record<ColorScheme, NightTheme> = {
  light: { night: [12, 20, 44], nightAlpha: 0.42, dusk: [255, 160, 80] },
  dark: { night: [1, 3, 9], nightAlpha: 0.62, dusk: [255, 150, 70] },
};

function smoothstep01(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * Night and dusk alpha for a point whose unit normal has `dot` with the sun
 * direction (1 = sun overhead, 0 = on the terminator, -1 = midnight).
 * `nightAlpha` is the theme value (alphaGain is applied here).
 */
export function nightAlpha(dot: number, nightAlpha: number): { night: number; dusk: number } {
  const nA = nightAlpha * NIGHT.alphaGain * smoothstep01((NIGHT.start - dot) / NIGHT.span);
  const gz = (dot - NIGHT.duskCenter) / NIGHT.duskWidth;
  const gA = gz > -4 && gz < 4 ? NIGHT.duskPeak * Math.exp(-gz * gz) : 0;
  return { night: nA, dusk: gA };
}

/** Combined coverage of night over dusk (prototype: 1 - (1 - nA)(1 - gA)). */
export function combinedAlpha(a: { night: number; dusk: number }): number {
  return 1 - (1 - a.night) * (1 - a.dusk);
}

/** Dot product of a surface point with the sun direction. */
export function sunDot(point: LonLat, sun: LonLat): number {
  const p1 = point[1] * RAD;
  const s1 = sun[1] * RAD;
  return Math.sin(p1) * Math.sin(s1) + Math.cos(p1) * Math.cos(s1) * Math.cos((point[0] - sun[0]) * RAD);
}

/**
 * The sun direction in view space for a camera: x right, y up, z toward the
 * viewer, matching the orthographic projection (screen = origin + R * (x, -y)).
 */
export function sunViewVector(camera: GlobeCamera, sun: LonLat): [number, number, number] {
  const [l, f] = geoRotation([-camera.center[0], -camera.center[1], 0])([sun[0], sun[1]]);
  const lr = l * RAD;
  const fr = f * RAD;
  return [Math.cos(fr) * Math.sin(lr), Math.sin(fr), Math.cos(fr) * Math.cos(lr)];
}

/** Sun positions are quantized to this many degrees before drawing. */
export const SUN_STEP_DEG = 0.1;

/**
 * Cache key for the night picture's sun: rounded to 0.1 deg, so the picture
 * is re-recorded only when the sun has moved that far (about every 24 s of
 * real time). The drawn sun is the quantized one (`sunFromKey`).
 */
export function sunKey(sun: LonLat): string {
  const q = (v: number) => {
    const r = Math.round(v / SUN_STEP_DEG) * SUN_STEP_DEG;
    return (r === 0 ? 0 : r).toFixed(1);
  };
  let lon = Number(q(sun[0]));
  if (lon >= 180) lon -= 360;
  return `${lon.toFixed(1)},${q(sun[1])}`;
}

export function sunFromKey(key: string): LonLat {
  const [lon, lat] = key.split(',').map(Number);
  return [lon, lat];
}

/** Real-time sky clock: tick at most once a minute while idle. */
export const SKY_IDLE_TICK_MS = 60_000;
/** During a flight preview the sky follows the simulated time at about 9 Hz. */
export const SKY_PREVIEW_MS = 110;

/**
 * Next sky time to draw: real time when idle; during a preview the
 * simulated time, but only once SKY_PREVIEW_MS has passed since the last
 * update (wall clock). Returns `prev` when nothing should change.
 */
export function nextSkyTime(
  prev: { utc: number; at: number },
  input: { nowMs: number; wallMs: number; simUtc: number | null },
): { utc: number; at: number } {
  const target = input.simUtc ?? input.nowMs;
  if (target === prev.utc) return prev;
  if (input.simUtc != null && input.wallMs - prev.at < SKY_PREVIEW_MS) return prev;
  return { utc: target, at: input.wallMs };
}
