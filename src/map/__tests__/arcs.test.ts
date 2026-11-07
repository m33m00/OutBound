import { geoDistance, geoInterpolate } from 'd3-geo';

import {
  arcLift,
  arcSamples,
  BOW,
  flowPoint,
  linkRouteLegs,
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
  it('runs from start to end, with only a faint lean on a lone leg (round 171)', () => {
    const s = arcSamples(DFW, LGA);
    expect(s[0].ll[0]).toBeCloseTo(DFW[0], 9);
    expect(s[0].ll[1]).toBeCloseTo(DFW[1], 9);
    expect(s[s.length - 1].ll[0]).toBeCloseTo(LGA[0], 9);
    expect(s[s.length - 1].ll[1]).toBeCloseTo(LGA[1], 9);
    const d = geoDistance([DFW[0], DFW[1]], [LGA[0], LGA[1]]);
    const mid = flowPoint(DFW, LGA, 0.5);
    // Halfway between the two airports, a whisper off the straight line, toward the pole.
    expect(geoDistance([DFW[0], DFW[1]], [mid[0], mid[1]])).toBeCloseTo(geoDistance([LGA[0], LGA[1]], [mid[0], mid[1]]), 3);
    const straight = geoInterpolate([DFW[0], DFW[1]], [LGA[0], LGA[1]])(0.5);
    expect(geoDistance(straight, [mid[0], mid[1]])).toBeCloseTo(BOW * d, 4);
    expect(mid[1]).toBeGreaterThan(straight[1]);
    // John: "The arch is too much." The lean is a small share of the leg.
    expect(BOW).toBeLessThanOrEqual(0.05);
  });

  it('leans the same way both directions, so a round trip reads as one line', () => {
    const there = flowPoint(DFW, LGA, 0.5);
    const back = flowPoint(LGA, DFW, 0.5);
    expect(there[0]).toBeCloseTo(back[0], 6);
    expect(there[1]).toBeCloseTo(back[1], 6);
  });

  it('leans a north-south leg east, and a same-airport leg stays put', () => {
    const DEN = [-104.67, 39.86] as const;
    const ABQ = [-106.61, 35.04] as const;
    const straight = geoInterpolate([ABQ[0], ABQ[1]], [DEN[0], DEN[1]])(0.5);
    expect(flowPoint(ABQ, DEN, 0.5)[0]).toBeGreaterThan(straight[0]);
    expect(flowPoint(DFW, DFW, 0.5)[0]).toBeCloseTo(DFW[0], 9);
  });

  it('flows through a stop with no corner (round 171)', () => {
    const ORD = [-87.9, 41.98] as const;
    const bearing = (p: readonly number[], q: readonly number[]) => (Math.atan2(q[0] - p[0], q[1] - p[1]) * 180) / Math.PI;
    const legA: RouteLeg = { id: 'a', from: DFW, to: ORD, fromCode: 'DFW', toCode: 'ORD', tier: 'good', source: 'reported' };
    const legB: RouteLeg = { id: 'b', from: ORD, to: LGA, fromCode: 'ORD', toCode: 'LGA', tier: 'tight', source: 'reported' };
    // Straight lines turn sharply at ORD.
    const sharp = Math.abs(bearing(DFW, ORD) - bearing(ORD, LGA));
    expect(sharp).toBeGreaterThan(30);
    linkRouteLegs([{ legs: [legA, legB] }]);
    const a = legSamples(legA);
    const b = legSamples(legB);
    const inAt = bearing(a[a.length - 2].ll, a[a.length - 1].ll);
    const outAt = bearing(b[0].ll, b[1].ll);
    // The corner at the stop is softened to about half, without bending the legs into humps.
    expect(Math.abs(inAt - outAt)).toBeLessThan(sharp * 0.55);
    expect(a[a.length - 1].ll[0]).toBeCloseTo(ORD[0], 9);
    expect(b[0].ll[0]).toBeCloseTo(ORD[0], 9);
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
