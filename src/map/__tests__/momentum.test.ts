import { LAT_LIMIT, panCamera, type GlobeCamera } from '../camera';
import { DRIFT_HOME, MOMENTUM, momentumStep, releaseVelocity, shouldDriftHome, type Velocity } from '../momentum';

const cam: GlobeCamera = { center: [-97, 38], radius: 180 };

/** Coast until done at 60 fps; returns the final camera and frame count. */
function coastAll(start: GlobeCamera, v: Velocity) {
  let c = start;
  let vel = v;
  for (let i = 1; i < 2000; i++) {
    const r = momentumStep(c, vel, 1000 / 60);
    c = r.camera;
    vel = r.velocity;
    if (r.done) return { camera: c, frames: i };
  }
  throw new Error('never stopped');
}

describe('flick to spin (design round 30)', () => {
  it('a slow release just stops; Reduce Motion never coasts', () => {
    expect(releaseVelocity(60, 40, false)).toBeNull();
    expect(releaseVelocity(1500, 0, true)).toBeNull();
    expect(releaseVelocity(Number.NaN, 0, false)).toBeNull();
    expect(releaseVelocity(1500, 0, false)).toEqual({ x: 1500, y: 0 });
  });

  it('caps a hard flick, keeping its direction', () => {
    const v = releaseVelocity(-9000, 3000, false)!;
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(MOMENTUM.maxSpeed, 6);
    expect(v.y / v.x).toBeCloseTo(3000 / -9000, 9);
  });

  it('keeps turning the way the finger went, like a longer drag', () => {
    const r = momentumStep(cam, { x: 1200, y: 0 }, 16);
    const drag = panCamera(cam, 1200 * 0.016, 0);
    expect(r.camera.center[0]).toBeCloseTo(drag.center[0], 9);
    expect(r.camera.center[0]).toBeLessThan(cam.center[0]); // finger right shows what is west
    expect(r.camera.radius).toBe(cam.radius);
    expect(r.velocity.x).toBeLessThan(1200);
    expect(r.done).toBe(false);
  });

  it('slows down smoothly and stops within a few seconds', () => {
    const { frames } = coastAll(cam, { x: 4000, y: 0 });
    expect(frames / 60).toBeGreaterThan(2);
    expect(frames / 60).toBeLessThan(6);
  });

  it('a strong flick spins the globe around (more than a half turn) but not endlessly', () => {
    let total = 0;
    let c = cam;
    let v: Velocity = { x: 3000, y: 0 };
    for (;;) {
      const r = momentumStep(c, v, 1000 / 60);
      let d = c.center[0] - r.camera.center[0];
      if (d < -180) d += 360;
      total += d;
      c = r.camera;
      v = r.velocity;
      if (r.done) break;
    }
    expect(total).toBeGreaterThan(180);
    expect(total).toBeLessThan(3 * 360);
  });

  it('frame time is capped, so a dropped frame does not jump the globe', () => {
    const big = momentumStep(cam, { x: 2000, y: 0 }, 1000);
    const capped = momentumStep(cam, { x: 2000, y: 0 }, MOMENTUM.maxStepMs);
    expect(big.camera.center[0]).toBeCloseTo(capped.camera.center[0], 9);
  });

  it('drops up/down speed at the latitude limit instead of sticking to the pole', () => {
    const r = momentumStep({ center: [0, 84.9], radius: 180 }, { x: 500, y: 3000 }, 16);
    expect(r.camera.center[1]).toBe(LAT_LIMIT);
    expect(r.velocity.y).toBe(0);
    expect(r.velocity.x).toBeGreaterThan(0);
  });
});

describe('drift home', () => {
  it('waits a few seconds, then glides slowly', () => {
    expect(DRIFT_HOME.delayMs).toBeGreaterThanOrEqual(3000);
    expect(DRIFT_HOME.durationMs).toBeGreaterThan(1500);
  });

  it('never with a route open, and not when already home', () => {
    expect(shouldDriftHome({ routeOpen: false, atHome: false })).toBe(true);
    expect(shouldDriftHome({ routeOpen: true, atHome: false })).toBe(false);
    expect(shouldDriftHome({ routeOpen: false, atHome: true })).toBe(false);
  });
});
