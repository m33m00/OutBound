import { useEffect, useMemo, useRef, useState } from 'react';

import { readLiveConfig, useRadar } from '@/live';
import type { RadarLayer } from '@/map';
import { drawableFrames, radarCaption, radarLayersFrom, type HeldRadar } from '@/search/radarText';

const ALL_REGIONS = ['conus', 'ak', 'hi', 'carib'] as const;
const NO_REGIONS: readonly string[] = [];

/**
 * Radar images for the globe. All four regions while on: our server only
 * re-fetches from NWS when a frame changes (Q-032 provisional). Skia can't send
 * headers, so the PNG bytes are fetched here with the anon key and handed over.
 */
export function useRadarLayers(on: boolean, now: number) {
  // The button shows whenever the live service is set up, even with radar off.
  const configured = useMemo(() => readLiveConfig() != null, []);
  const radar = useRadar(on ? ALL_REGIONS : NO_REGIONS);
  const drawn = useMemo(() => drawableFrames(radar.frames, now), [radar.frames, now]);
  const [held, setHeld] = useState<HeldRadar>({});
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    for (const f of drawn) {
      const key = `${f.region}@${f.observedAt}`;
      if (held[f.region]?.observedAt === f.observedAt || inFlight.current.has(key)) continue;
      inFlight.current.add(key);
      fetch(f.image.uri, { headers: f.image.headers })
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((buf) => {
          if (!alive) return;
          setHeld((prev) => ({
            ...prev,
            [f.region]: { observedAt: f.observedAt, bbox: f.bbox, bytes: new Uint8Array(buf) },
          }));
        })
        .catch(() => {
          // Keep showing the previous image; the next poll tries again.
        })
        .finally(() => inFlight.current.delete(key));
    }
    return () => {
      alive = false;
    };
    // `held` is read only to skip images we already have.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn]);

  // Drop held images when radar is turned off.
  useEffect(() => {
    if (!on) setHeld({});
  }, [on]);

  const layers = useMemo<RadarLayer[]>(() => (on ? radarLayersFrom(drawn, held, now) : []), [on, drawn, held, now]);
  const shownFrames = drawn.filter((f) => layers.some((l) => l.region === f.region));

  return {
    layers,
    caption: radarCaption(on, radar.state, shownFrames.length ? shownFrames : drawn, now),
    available: configured,
  };
}
