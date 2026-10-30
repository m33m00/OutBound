import { globeOrigin, type GlobeCamera, type Viewport } from '../camera';
import { FLY_MS, interpolateCamera, planRetarget, REFRAME_MS, sameCamera } from '../flyTo';
import { markSpinInDone, resetSpinInForTests, shouldSpinIn, SPIN_IN, spinStartCamera } from '../spinIn';

const vp: Viewport = { width: 390, height: 700, insets: { top: 0, right: 0, bottom: 300, left: 0 } };
const target: GlobeCamera = { center: [-97, 38], radius: 180 };

beforeEach(() => resetSpinInForTests());

describe('spin-in', () => {
  it('starts rotated (prototype rot + [150, 18]), small and high', () => {
    const s = spinStartCamera(target, vp);
    expect(s.center[0]).toBeCloseTo(113, 9); // -97 - 150 wrapped
    expect(s.center[1]).toBeCloseTo(20, 9);
    expect(s.radius).toBeCloseTo(0.36 * 390, 9);
    expect(globeOrigin(vp).y + (s.offsetY ?? 0)).toBeCloseTo(0.36 * 700, 9);
  });

  it('flies 2100 ms back to the normal camera, offset reaching 0', () => {
    expect(SPIN_IN.durationMs).toBe(2100);
    const s = spinStartCamera(target, vp);
    const end = interpolateCamera(s, target, 1);
    expect(sameCamera(end, target)).toBe(true);
    const mid = interpolateCamera(s, target, 0.5);
    expect(mid.offsetY).toBeCloseTo((s.offsetY ?? 0) / 2, 9);
  });

  it('plays once per launch, only with a real layout', () => {
    expect(shouldSpinIn({ reduceMotion: false, width: 0, height: 700 })).toBe(false);
    expect(shouldSpinIn({ reduceMotion: false, width: 390, height: 700 })).toBe(true);
    markSpinInDone();
    expect(shouldSpinIn({ reduceMotion: false, width: 390, height: 700 })).toBe(false);
  });

  it('is skipped under Reduce Motion', () => {
    expect(shouldSpinIn({ reduceMotion: true, width: 390, height: 700 })).toBe(false);
  });
});

describe('retarget during the spin-in', () => {
  const s = spinStartCamera(target, vp);
  const mid = interpolateCamera(s, target, 0.4);
  const running = { to: target, endsAt: 2000, spin: true };
  const routeFit: GlobeCamera = { center: [-80, 35], radius: 400 };

  it('a route selection / fit cancels the spin and flies 900 ms from where it is', () => {
    expect(planRetarget({ isNewTarget: true, from: mid, to: routeFit, running, reduceMotion: false, nowMs: 1000 })).toEqual({
      kind: 'fly',
      durationMs: FLY_MS,
      spin: false,
    });
    // The raised offset flies back to 0 with that flight.
    expect(interpolateCamera(mid, routeFit, 1).offsetY).toBeUndefined();
  });

  it('jumps under Reduce Motion', () => {
    expect(planRetarget({ isNewTarget: true, from: mid, to: routeFit, running, reduceMotion: true, nowMs: 1000 })).toEqual({ kind: 'jump' });
  });

  it('a layout re-frame keeps the spin going for the time left', () => {
    expect(planRetarget({ isNewTarget: false, from: mid, to: target, running, reduceMotion: false, nowMs: 1000 })).toEqual({
      kind: 'continue',
      durationMs: 1000,
      spin: true,
    });
  });

  it('a re-frame at rest glides with the panel, and jumps under Reduce Motion or when nothing moved (design round 29)', () => {
    expect(planRetarget({ isNewTarget: false, from: mid, to: target, running: null, reduceMotion: false, nowMs: 1000 })).toEqual({
      kind: 'fly',
      durationMs: REFRAME_MS,
      spin: false,
    });
    expect(planRetarget({ isNewTarget: false, from: mid, to: target, running: null, reduceMotion: true, nowMs: 1000 })).toEqual({ kind: 'jump' });
    expect(planRetarget({ isNewTarget: false, from: target, to: target, running: null, reduceMotion: false, nowMs: 1000 })).toEqual({ kind: 'jump' });
  });
});
