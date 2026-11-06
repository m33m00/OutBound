import { geoDistance, geoInterpolate } from 'd3-geo';

import {
  arcLift,
  arcSamples,
  BOW,
  bowedPoint,
  legFramePoints,
  legSamples,
  makeLiftedProjector,
  projectSamples,
  runsToSvg,
} from '../arcs';
import { globeOrigin, normalizeInsets, projectionFor, type Viewport } from '../camera';
import type { RouteLeg } from '../types';

const vp: Viewport = { width: 400, height: 800, insets: normalizeInsets({ top: 60, bottom: 340 }) };
const DFW = [-97.04, 32.9] as const;
const LGA = [-73.87, 40.78] as const;
const leg: RouteLeg = { id: 'l1', from: DFW, to: LGA, fromCode: 'DFW', toCode: 'LGA', tier: 'good', source: 'reported' };

describe('arc samples (computed once per leg)', () => {
  it('runs from start to end, curving out to the side in the middle (round 170)', () => {
    const s = arcSamples(DFW, LGA);
    expect(s[0].ll[0]).toBeCloseTo(DFW[0], 9);
    expect(s[0].ll[1]).toBeCloseTo(DFW[1], 9);
    expect(s[s.length - 1].ll[0]).toBeCloseTo(LGA[0], 9);
    expect(s[s.length - 1].ll[1]).toBeCloseTo(LGA[1], 9);
    const d = geoDistance([DFW[0], DFW[1]], [LGA[0], LGA[1]]);
    const mid = bowedPoint(DFW, LGA, 0.5);
    // Still halfway between the two airports...
    expect(geoDistance([DFW[0], DFW[1]], [mid[0], mid[1]])).toBeCloseTo(geoDistance([LGA[0], LGA[1]], [mid[0], mid[1]]), 3);
    // ...but swung off the straight great circle by the bow, toward the pole.
    const straight = geoInterpolate([DFW[0], DFW[1]], [LGA[0], LGA[1]])(0.5);
    expect(geoDistance(straight, [mid[0], mid[1]])).toBeCloseTo(BOW * d, 4);
    expect(mid[1]).toBeGreaterThan(straight[1]);
    // The drawn samples carry the same curve.
    const far = Math.max(...s.map((x) => geoDistance([x.ll[0], x.ll[1]], straight)));
    expect(Math.min(...s.map((x) => geoDistance([x.ll[0], x.ll[1]], straight)))).toBeLessThan(BOW * d * 1.05);
    expect(far).toBeGreaterThan(d / 2);
  });

  it('bows the same way both directions, so a round trip reads as one curve', () => {
    const there = bowedPoint(DFW, LGA, 0.5);
    const back = bowedPoint(LGA, DFW, 0.5);
    expect(there[0]).toBeCloseTo(back[0], 6);
    expect(there[1]).toBeCloseTo(back[1], 6);
  });

  it('bows a north-south leg east, and a same-airport leg stays put', () => {
    const DEN = [-104.67, 39.86] as const;
    const ABQ = [-106.61, 35.04] as const;
    const straight = geoInterpolate([ABQ[0], ABQ[1]], [DEN[0], DEN[1]])(0.5);
    expect(bowedPoint(ABQ, DEN, 0.5)[0]).toBeGreaterThan(straight[0]);
    expect(bowedPoint(DFW, DFW, 0.5)[0]).toBeCloseTo(DFW[0], 9);
  });

  it('keeps the curve gentle: the bend is a small share of the leg', () => {
    expect(BOW).toBeGreaterThan(0.05);
    expect(BOW).toBeLessThan(0.2);
  });

  it('uses at least 24 samples, more for long legs', () => {
    expect(arcSamples(DFW, [-96, 33]).length).toBe(25);
    expect(arcSamples(DFW, [139.78, 35.55]).length).toBeGreaterThan(200);
  });

  it('lifts off the surface in the middle, more for long legs', () => {
    const s = arcSamples(DFW, LGA);
    expect(s[0].lift).toBeCloseTo(1, 9);
    expect(s[s.length - 1].lift).toBeCloseTo(1, 9);
    expect(Math.max(...s.map((x) => x.lift))).toBeCloseTo(1 + arcLift(geoDistance([DFW[0], DFW[1]], [LGA[0], LGA[1]])), 3);
    expect(arcLift(0.1)).toBeLessThan(arcLift(1));
    expect(arcLift(5)).toBeCloseTo(0.122, 6);
  });

  it('caches per leg object', () => {
    expect(legSamples(leg)).toBe(legSamples(leg));
  });
});

describe('lifted projection', () => {
  const cam = { center: [-90, 38] as const, radius: 300 };

  it('matches the orthographic projection on the surface', () => {
    const lifted = makeLiftedProjector(cam, vp);
    const proj = projectionFor(cam, vp);
    const p = lifted(DFW, 1);
    const q = proj([DFW[0], DFW[1]])!;
    expect(p.visible).toBe(true);
    expect(p.x).toBeCloseTo(q[0], 6);
    expect(p.y).toBeCloseTo(q[1], 6);
  });

  it('lifted points move away from the globe center', () => {
    const lifted = makeLiftedProjector(cam, vp);
    const o = globeOrigin(vp);
    const a = lifted(DFW, 1);
    const b = lifted(DFW, 1.1);
    expect(Math.hypot(b.x - o.x, b.y - o.y)).toBeCloseTo(1.1 * Math.hypot(a.x - o.x, a.y - o.y), 6);
  });

  it('hides the far side (surface points = clipAngle 90)', () => {
    expect(makeLiftedProjector(cam, vp)([90, -38], 1).visible).toBe(false);
    const lifted = makeLiftedProjector({ center: [-90, 0], radius: 300 }, vp);
    expect(lifted([-90 + 89, 0], 1).visible).toBe(true);
    expect(lifted([-90 + 91, 0], 1).visible).toBe(false);
    // Just past the horizon but lifted outside the silhouette: still seen.
    expect(lifted([-90 + 91, 0], 1.1).visible).toBe(true);
  });

  it('splits runs where the arc goes behind the globe', () => {
    // Camera over the US; a DFW -> Tokyo leg leaves the visible side.
    const lifted = makeLiftedProjector(cam, vp);
    const runs = projectSamples(arcSamples(DFW, [139.78, 35.55]), lifted);
    const all = arcSamples(DFW, [139.78, 35.55]).length;
    const drawn = runs.reduce((n, r) => n + r.length, 0);
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(drawn).toBeLessThan(all);
    for (const r of runs) expect(r.length).toBeGreaterThan(1);
  });

  it('draws nothing for a leg entirely on the far side', () => {
    const lifted = makeLiftedProjector({ center: [100, -30], radius: 300 }, vp);
    expect(projectSamples(arcSamples(DFW, LGA), lifted)).toEqual([]);
    expect(runsToSvg([])).toBeNull();
  });

  it('ground shadow uses the surface (lift 1)', () => {
    const lifted = makeLiftedProjector(cam, vp);
    const proj = projectionFor(cam, vp);
    const s = arcSamples(DFW, LGA);
    const ground = projectSamples(s, lifted, true)[0];
    const mid = Math.floor(s.length / 2);
    const q = proj([s[mid].ll[0], s[mid].ll[1]])!;
    expect(ground[mid].x).toBeCloseTo(q[0], 6);
    expect(ground[mid].y).toBeCloseTo(q[1], 6);
  });

  it('builds one SVG path for all runs', () => {
    const d = runsToSvg([
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { x: 5, y: 5 },
        { x: 6.04, y: 6 },
      ],
    ]);
    expect(d).toBe('M0.0 0.0L1.0 1.0M5.0 5.0L6.0 6.0');
  });
});

describe('frame points', () => {
  it('include the ends and the great-circle bow', () => {
    const pts = legFramePoints({ from: [-73.78, 40.64], to: [-0.45, 51.47] });
    expect(pts).toHaveLength(5);
    // JFK -> LHR bows north of both ends.
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(51.47);
  });
});
