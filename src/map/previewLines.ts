/**
 * Which lines the home globe previews between From and To (round 224, John: "Can you draw the routlines too as
 * a preview when showing lets say United States of America to Madrid, Spain").
 *
 * One airport each side: the one line. A place on either side: up to PREVIEW_MAX lines, from airports spread
 * across the bigger side (one per city first, then as far apart as they go), each to the nearest airport on the
 * other side. It's a picture of where, not of real flights: those come with the search.
 */
import { geoDistance } from 'd3-geo';

import type { LonLat } from './types';

/** Enough to read as a fan, few enough to stay clean (John's DAL hub picture had dozens; this is a preview). */
export const PREVIEW_MAX = 8;

export interface PreviewEnd {
  code: string;
  coord: LonLat;
  /** Same city, same spot on a globe: only one of them gets a line until every city has one. */
  city?: string;
}

export interface PreviewLine {
  from: PreviewEnd;
  to: PreviewEnd;
}

const far = (a: LonLat, b: LonLat) => geoDistance([a[0], a[1]], [b[0], b[1]]);

/** Up to `n` of `ends`, spread out: one per city first, each next the farthest from those already picked. */
export function spreadEnds(ends: readonly PreviewEnd[], n: number): PreviewEnd[] {
  if (ends.length <= n) return [...ends];
  const cities = new Map<string, PreviewEnd>();
  for (const e of ends) if (!cities.has(e.city ?? e.code)) cities.set(e.city ?? e.code, e);
  const pool = cities.size >= n ? [...cities.values()] : [...ends];
  // Start at the one farthest from the middle of them all, so the picks reach the edges.
  const mid: LonLat = [
    pool.reduce((s, e) => s + e.coord[0], 0) / pool.length,
    pool.reduce((s, e) => s + e.coord[1], 0) / pool.length,
  ];
  const picked: PreviewEnd[] = [pool.reduce((best, e) => (far(e.coord, mid) > far(best.coord, mid) ? e : best))];
  while (picked.length < n) {
    let best: PreviewEnd | null = null;
    let bestD = -1;
    for (const e of pool) {
      if (picked.includes(e)) continue;
      const d = Math.min(...picked.map((p) => far(e.coord, p.coord)));
      if (d > bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  return picked;
}

/** The preview lines from one side's airports to the other's. */
export function previewLines(from: readonly PreviewEnd[], to: readonly PreviewEnd[], max = PREVIEW_MAX): PreviewLine[] {
  if (!from.length || !to.length) return [];
  const fromBigger = from.length >= to.length;
  const big = spreadEnds(fromBigger ? from : to, max);
  const small = fromBigger ? to : from;
  const pairs = big.map((b) => ({
    b,
    s: small.reduce((best, s) => (far(s.coord, b.coord) < far(best.coord, b.coord) ? s : best)),
  }));
  // Every airport on the smaller side gets at least one line where there are lines to spare, so Spain shows
  // Barcelona as well as Madrid: a line moves over from an airport that has several, picking the one that
  // crosses the fewest other lines (then the nearest), so the fan stays tidy.
  for (const s of small) {
    if (pairs.some((p) => p.s === s)) continue;
    const spare = pairs.filter((p) => pairs.filter((q) => q.s === p.s).length > 1);
    if (!spare.length) break;
    const score = (p: (typeof pairs)[number]) => {
      const was = p.s;
      p.s = s;
      const n = crossings(pairs.map((q) => [q.b.coord, q.s.coord]));
      p.s = was;
      return n;
    };
    const scored = spare.map((p) => ({ p, n: score(p), d: far(p.b.coord, s.coord) }));
    scored.sort((x, y) => x.n - y.n || x.d - y.d);
    scored[0].p.s = s;
  }
  return pairs.map(({ b, s }) => (fromBigger ? { from: b, to: s } : { from: s, to: b })).filter((l) => l.from.code !== l.to.code);
}

/** How many pairs of lines cross, judged flat on longitude and latitude (plenty for tidying a small fan). */
function crossings(lines: readonly (readonly [LonLat, LonLat])[]): number {
  const side = (a: LonLat, b: LonLat, c: LonLat) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const same = (a: LonLat, b: LonLat) => a[0] === b[0] && a[1] === b[1];
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [a, b] = lines[i];
      const [c, d] = lines[j];
      // Lines that share an airport meet there; that's not a crossing.
      if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) continue;
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) n++;
    }
  }
  return n;
}
