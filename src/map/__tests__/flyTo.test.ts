import type { GlobeCamera } from '../camera';
import {
  FLY_MS,
  FLY_ZOOM_BUMP,
  easeCubicInOut,
  interpolateCamera,
  planCameraMove,
  sameCamera,
} from '../flyTo';

const a: GlobeCamera = { center: [-97, 38], radius: 300 };
const b: GlobeCamera = { center: [-80, 30], radius: 900 };

describe('easing', () => {
  it('is cubic ease-in-out, clamped', () => {
    expect(easeCubicInOut(0)).toBe(0);
    expect(easeCubicInOut(0.5)).toBe(0.5);
    expect(easeCubicInOut(1)).toBe(1);
    expect(easeCubicInOut(0.25)).toBeCloseTo(0.0625, 9);
    expect(easeCubicInOut(-1)).toBe(0);
    expect(easeCubicInOut(2)).toBe(1);
  });
});

describe('interpolateCamera', () => {
  it('starts at from and ends exactly at to', () => {
    expect(interpolateCamera(a, b, 0)).toEqual(a);
    expect(interpolateCamera(a, b, 1)).toBe(b);
  });

  it('zooms out a little mid-flight', () => {
    const mid = interpolateCamera(a, b, 0.5);
    expect(mid.center[0]).toBeCloseTo(-88.5, 9);
    expect(mid.center[1]).toBeCloseTo(34, 9);
    expect(mid.radius).toBeCloseTo(600 * (1 - FLY_ZOOM_BUMP), 9);
  });

  it('takes the short way across the antimeridian', () => {
    const west: GlobeCamera = { center: [170, 0], radius: 300 };
    const east: GlobeCamera = { center: [-170, 0], radius: 300 };
    const mid = interpolateCamera(west, east, 0.5);
    expect(Math.abs(mid.center[0])).toBeCloseTo(180, 9);
    const q = interpolateCamera(west, east, 0.25);
    expect(q.center[0]).toBeCloseTo(175, 9);
  });
});

describe('planCameraMove (Reduce Motion branch)', () => {
  it('flies for about 0.9 s normally', () => {
    expect(FLY_MS).toBeGreaterThanOrEqual(600);
    expect(FLY_MS).toBeLessThanOrEqual(900);
    expect(planCameraMove(a, b, false)).toEqual({ animate: true, durationMs: FLY_MS });
  });

  it('jumps instantly with Reduce Motion on', () => {
    expect(planCameraMove(a, b, true)).toEqual({ animate: false });
  });

  it('jumps on first placement and when nothing changes', () => {
    expect(planCameraMove(null, b, false)).toEqual({ animate: false });
    expect(planCameraMove(a, { center: [-97.001, 38], radius: 300.1 }, false)).toEqual({ animate: false });
    expect(sameCamera({ center: [179.999, 0], radius: 1 }, { center: [-180, 0], radius: 1 })).toBe(true);
  });
});
