import type { RadarFrame } from '@/live';

import { drawableFrames, radarCaption, radarLayersFrom, RADAR_MAX_AGE_MS } from '../radarText';

const NOW = Date.UTC(2026, 9, 14, 8);
const frame = (region: RadarFrame['region'], minAgo: number, available = true): RadarFrame => ({
  region,
  observedAt: new Date(NOW - minAgo * 60_000).toISOString(),
  bbox: [-125, 20, -65, 50],
  width: 1536,
  height: 768,
  image: { uri: 'https://x/functions/v1/live-radar?image=conus', headers: {} },
  stale: minAgo > 10,
  available,
});

describe('radar overlay rules', () => {
  it('draws only available frames no older than 30 min', () => {
    const frames = [frame('conus', 4), frame('ak', RADAR_MAX_AGE_MS / 60_000 + 1), frame('hi', 2, false)];
    expect(drawableFrames(frames, NOW).map((f) => f.region)).toEqual(['conus']);
  });

  it('captions with the oldest drawn frame age and the source', () => {
    expect(radarCaption(true, 'ready', [frame('conus', 2), frame('hi', 4)], NOW)).toBe('Radar 4m ago · NOAA/NWS');
  });

  it('says loading or unavailable, and nothing when off', () => {
    expect(radarCaption(true, 'loading', [], NOW)).toBe('Radar loading…');
    expect(radarCaption(true, 'ready', [], NOW)).toBe('Radar unavailable');
    expect(radarCaption(true, 'error', [], NOW)).toBe('Radar unavailable');
    expect(radarCaption(false, 'ready', [frame('conus', 2)], NOW)).toBeNull();
    expect(radarCaption(true, 'off', [], NOW)).toBeNull();
  });
});

describe('radarLayersFrom', () => {
  const bytes = new Uint8Array([1]);
  it('keeps the previous image while a newer frame downloads', () => {
    const held = { conus: { observedAt: new Date(NOW - 6 * 60_000).toISOString(), bbox: [-125, 20, -65, 50] as [number, number, number, number], bytes } };
    expect(radarLayersFrom([frame('conus', 1)], held, NOW)).toEqual([
      { region: 'conus', bbox: held.conus.bbox, observedAt: held.conus.observedAt, bytes },
    ]);
  });
  it('drops images past the max age and regions no longer offered', () => {
    const old = { conus: { observedAt: new Date(NOW - RADAR_MAX_AGE_MS - 60_000).toISOString(), bbox: [-125, 20, -65, 50] as [number, number, number, number], bytes } };
    expect(radarLayersFrom([frame('conus', 1)], old, NOW)).toEqual([]);
    expect(radarLayersFrom([], { conus: { ...old.conus, observedAt: new Date(NOW).toISOString() } }, NOW)).toEqual([]);
  });
});
