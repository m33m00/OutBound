/** Radar overlay rules and caption text (items 13-14; Q-031, Q-032). Pure. */
import type { RadarFrame } from '@/live';

import { formatAge } from './format';

/** Hide a frame older than this, even if the server still sends it (provisional, DECISIONS.md). */
export const RADAR_MAX_AGE_MS = 30 * 60_000;

/** Frames worth drawing: available and not older than the max age. */
export function drawableFrames(frames: readonly RadarFrame[], now: number): RadarFrame[] {
  return frames.filter((f) => f.available && now - Date.parse(f.observedAt) <= RADAR_MAX_AGE_MS);
}

/**
 * Caption under the map button. Every value shows its age, so it uses the
 * oldest frame drawn. Null when radar is off or the service isn't set up.
 */
export function radarCaption(
  on: boolean,
  state: 'off' | 'loading' | 'ready' | 'error',
  drawn: readonly RadarFrame[],
  now: number,
): string | null {
  if (!on || state === 'off') return null;
  if (state === 'loading') return 'Radar loading…';
  if (!drawn.length) return 'Radar unavailable';
  const oldest = Math.min(...drawn.map((f) => Date.parse(f.observedAt)));
  return `Radar ${formatAge(oldest, now)} · NOAA/NWS`;
}

/** The newest downloaded image per region. */
export type HeldRadar = Record<string, { observedAt: string; bbox: RadarFrame['bbox']; bytes: Uint8Array }>;

/**
 * Layers to draw: for each region still offered, the newest image we hold,
 * even while a newer frame downloads (no blank flash between updates), as
 * long as that image is within the max age.
 */
export function radarLayersFrom(drawn: readonly RadarFrame[], held: HeldRadar, now: number) {
  return drawn.flatMap((f) => {
    const h = held[f.region];
    if (!h || now - Date.parse(h.observedAt) > RADAR_MAX_AGE_MS) return [];
    return [{ region: f.region, bbox: h.bbox, observedAt: h.observedAt, bytes: h.bytes }];
  });
}
