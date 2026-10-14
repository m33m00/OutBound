import { hitTestRoutes, polylineDistance, segmentDistance, type HitLine } from '../hitTest';
import { MAP_LINE_HIT_AREA } from '../types';

const h = (routeId: string, y: number): HitLine => ({
  routeId,
  runs: [[{ x: 0, y }, { x: 100, y }]],
});

describe('distance helpers', () => {
  it('measures to the segment, clamped at the ends', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(segmentDistance({ x: 5, y: 3 }, a, b)).toBe(3);
    expect(segmentDistance({ x: -3, y: 4 }, a, b)).toBe(5);
    expect(segmentDistance({ x: 13, y: 4 }, a, b)).toBe(5);
    expect(segmentDistance({ x: 1, y: 1 }, a, a)).toBeCloseTo(Math.SQRT2, 9);
  });

  it('takes the nearest run and ignores gaps between runs', () => {
    const runs = [
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      [{ x: 50, y: 0 }, { x: 60, y: 0 }],
    ];
    expect(polylineDistance({ x: 55, y: 2 }, runs)).toBe(2);
    // Over the gap (hidden part of the arc) the distance is to the run ends.
    expect(polylineDistance({ x: 30, y: 0 }, runs)).toBe(20);
    expect(polylineDistance({ x: 0, y: 0 }, [])).toBe(Infinity);
  });
});

describe('hitTestRoutes (28pt)', () => {
  it('uses a 28pt hit area', () => {
    expect(MAP_LINE_HIT_AREA).toBe(28);
    expect(hitTestRoutes({ x: 50, y: 27.9 }, [h('a', 0)], null)).toBe('a');
    expect(hitTestRoutes({ x: 50, y: 28 }, [h('a', 0)], null)).toBeNull();
  });

  it('returns null when nothing is close', () => {
    expect(hitTestRoutes({ x: 50, y: 200 }, [h('a', 0), h('b', 100)], null)).toBeNull();
    expect(hitTestRoutes({ x: 50, y: 0 }, [], null)).toBeNull();
  });

  it('picks the nearest route', () => {
    expect(hitTestRoutes({ x: 50, y: 12 }, [h('a', 0), h('b', 20)], null)).toBe('b');
    expect(hitTestRoutes({ x: 50, y: 8 }, [h('a', 0), h('b', 20)], null)).toBe('a');
  });

  it('prefers the selected route whenever it is in range', () => {
    expect(hitTestRoutes({ x: 50, y: 18 }, [h('a', 0), h('b', 20)], 'a')).toBe('a');
    // Selected out of range: nearest other route wins.
    expect(hitTestRoutes({ x: 50, y: 45 }, [h('a', 0), h('b', 40)], 'a')).toBe('b');
  });

  it('breaks ties toward the earlier route (earliest arriving)', () => {
    expect(hitTestRoutes({ x: 50, y: 5 }, [h('a', 0), h('b', 0)], null)).toBe('a');
    expect(hitTestRoutes({ x: 50, y: 5 }, [h('b', 0), h('a', 0)], null)).toBe('b');
  });

  it('a route listed as several legs counts its nearest leg', () => {
    const lines = [h('a', 0), h('a', 100), h('b', 60)];
    expect(hitTestRoutes({ x: 50, y: 95 }, lines, null)).toBe('a');
  });
});
