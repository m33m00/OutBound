import {
  DEFAULT_CENTER,
  LAT_LIMIT,
  MAX_RADIUS_FACTOR,
  MIN_RADIUS_FACTOR,
  cameraForTarget,
  clampLat,
  clampRadius,
  defaultCamera,
  fitRadius,
  globeOrigin,
  isOnFrontSide,
  normalizeInsets,
  normalizeLon,
  panCamera,
  pinchCamera,
  projectionFor,
  wantsHighDetail,
  type Viewport,
} from '../camera';

const vp: Viewport = { width: 400, height: 800, insets: normalizeInsets({ top: 60, bottom: 340 }) };

describe('clamping', () => {
  it('clamps latitude to ±85', () => {
    expect(clampLat(120)).toBe(LAT_LIMIT);
    expect(clampLat(-120)).toBe(-LAT_LIMIT);
    expect(clampLat(42)).toBe(42);
  });

  it('wraps longitude into [-180, 180)', () => {
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(180)).toBe(-180);
    expect(normalizeLon(720 + 10)).toBe(10);
    expect(Object.is(normalizeLon(0), 0)).toBe(true);
  });

  it('clamps radius between 0.42 and 6 view widths', () => {
    expect(clampRadius(1, 400)).toBe(400 * MIN_RADIUS_FACTOR);
    expect(clampRadius(1e6, 400)).toBe(400 * MAX_RADIUS_FACTOR);
    expect(clampRadius(500, 400)).toBe(500);
  });
});

describe('viewport', () => {
  it('centers the globe in the area left after insets', () => {
    expect(globeOrigin(vp)).toEqual({ x: 200, y: 60 + (800 - 60 - 340) / 2 });
  });

  it('fits zoom 1 to the smaller visible side', () => {
    // visible 400 x 400 -> 0.45 * 400 = 180
    expect(fitRadius(vp)).toBe(180);
  });

  it('starts on the default center', () => {
    expect(defaultCamera(vp)).toEqual({ center: DEFAULT_CENTER, radius: 180 });
  });
});

describe('gestures', () => {
  const start = { center: [-97, 38] as const, radius: 300 };

  it('drag right shows what is west; drag down shows what is north', () => {
    const right = panCamera(start, 50, 0);
    expect(right.center[0]).toBeLessThan(-97);
    expect(right.center[1]).toBe(38);
    const down = panCamera(start, 0, 50);
    expect(down.center[1]).toBeGreaterThan(38);
    expect(down.radius).toBe(300);
  });

  it('drags slower when zoomed in', () => {
    const near = panCamera({ ...start, radius: 1200 }, 100, 0);
    const far = panCamera(start, 100, 0);
    expect(Math.abs(near.center[0] + 97)).toBeLessThan(Math.abs(far.center[0] + 97));
  });

  it('never drags past the poles', () => {
    expect(panCamera(start, 0, 1e5).center[1]).toBe(LAT_LIMIT);
    expect(panCamera(start, 0, -1e5).center[1]).toBe(-LAT_LIMIT);
  });

  it('pinch scales from the start radius within limits', () => {
    expect(pinchCamera(start, 300, 2, 400).radius).toBe(600);
    expect(pinchCamera(start, 300, 100, 400).radius).toBe(400 * MAX_RADIUS_FACTOR);
    expect(pinchCamera(start, 300, 0.01, 400).radius).toBe(400 * MIN_RADIUS_FACTOR);
    expect(pinchCamera(start, 300, 2, 400).center).toBe(start.center);
  });
});

describe('cameraForTarget', () => {
  it('centers on a point at the requested zoom', () => {
    const cam = cameraForTarget({ kind: 'center', center: [-84.4, 33.6], zoom: 2 }, vp, null);
    expect(cam.center).toEqual([-84.4, 33.6]);
    expect(cam.radius).toBe(360);
  });

  it('clamps an out-of-range center', () => {
    const cam = cameraForTarget({ kind: 'center', center: [200, 89] }, vp, null);
    expect(cam.center).toEqual([-160, LAT_LIMIT]);
  });

  it('v1 fit stub: centroid of the points, current zoom kept', () => {
    const cur = { center: [0, 0] as const, radius: 777 };
    const cam = cameraForTarget(
      { kind: 'fit', points: [[-97.04, 32.9], [-87.9, 41.98]] },
      vp,
      cur,
    );
    expect(cam.radius).toBe(777);
    expect(cam.center[0]).toBeGreaterThan(-97.04);
    expect(cam.center[0]).toBeLessThan(-87.9);
    expect(cam.center[1]).toBeGreaterThan(32.9);
    expect(cam.center[1]).toBeLessThan(41.98);
  });

  it('fit with no points keeps the current camera', () => {
    const cur = { center: [10, 10] as const, radius: 300 };
    expect(cameraForTarget({ kind: 'fit', points: [] }, vp, cur)).toBe(cur);
  });
});

describe('projection', () => {
  const cam = { center: [-97, 38] as const, radius: 300 };

  it('puts the camera center on the globe origin', () => {
    const p = projectionFor(cam, vp)([-97, 38]);
    const o = globeOrigin(vp);
    expect(p![0]).toBeCloseTo(o.x, 6);
    expect(p![1]).toBeCloseTo(o.y, 6);
  });

  it('north is up and east is right', () => {
    const proj = projectionFor(cam, vp);
    const o = globeOrigin(vp);
    expect(proj([-97, 48])![1]).toBeLessThan(o.y);
    expect(proj([-87, 38])![0]).toBeGreaterThan(o.x);
  });

  it('knows which side of the globe a point is on', () => {
    expect(isOnFrontSide(cam, [-80, 40])).toBe(true);
    expect(isOnFrontSide(cam, [83, -38])).toBe(false);
  });

  it('switches to 50m detail above 2.1 view widths', () => {
    expect(wantsHighDetail({ ...cam, radius: 840 }, 400)).toBe(false);
    expect(wantsHighDetail({ ...cam, radius: 841 }, 400)).toBe(true);
  });
});
