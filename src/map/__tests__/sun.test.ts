import type { GlobeCamera } from '../camera';
import {
  combinedAlpha,
  NIGHT,
  NIGHT_THEME,
  nightAlpha,
  sunDot,
  sunFromKey,
  sunKey,
  sunPosition,
  sunViewVector,
} from '../sun';

const lonDiff = (a: number, b: number) => {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
};

describe('sunPosition', () => {
  it('puts the sun on the equator at the March equinox', () => {
    // 2024-03-20 03:06 UTC
    const [lon, lat] = sunPosition(Date.UTC(2024, 2, 20, 3, 6));
    expect(Math.abs(lat)).toBeLessThan(0.5);
    // GHA = -8.9 h * 15 + EoT (-7.5 min = -1.9 deg) => lon +135.4
    expect(lonDiff(lon, 135.4)).toBeLessThan(0.5);
  });

  it('puts the sun on the Tropic of Cancer at the June solstice', () => {
    // 2024-06-20 20:51 UTC; GHA = 8.85 h * 15 + EoT (-1.5 min = -0.4 deg) => lon -132.4
    const [lon, lat] = sunPosition(Date.UTC(2024, 5, 20, 20, 51));
    expect(lat).toBeGreaterThan(23.44 - 0.5);
    expect(lat).toBeLessThan(23.44 + 0.5);
    expect(lonDiff(lon, -132.4)).toBeLessThan(0.5);
  });

  it('puts the sun on the Tropic of Capricorn at the December solstice', () => {
    // 2024-12-21 09:20 UTC; GHA = -2.67 h * 15 + EoT (+1.7 min = +0.4 deg) => lon +39.6
    const [lon, lat] = sunPosition(Date.UTC(2024, 11, 21, 9, 20));
    expect(lat).toBeGreaterThan(-23.44 - 0.5);
    expect(lat).toBeLessThan(-23.44 + 0.5);
    expect(lonDiff(lon, 39.6)).toBeLessThan(0.5);
  });

  it('moves west 15 deg per hour and keeps lon in [-180, 180)', () => {
    const t = Date.UTC(2025, 0, 1, 0, 0);
    const a = sunPosition(t);
    const b = sunPosition(t + 3600_000);
    expect(lonDiff(a[0] - 15, b[0])).toBeLessThan(0.05);
    for (let h = 0; h < 24; h++) {
      const [lon] = sunPosition(t + h * 3600_000);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThan(180);
    }
  });
});

describe('nightAlpha', () => {
  const na = NIGHT_THEME.dark.nightAlpha;

  it('has no night above the start threshold (dot 0.10)', () => {
    expect(nightAlpha(0.1, na).night).toBe(0);
    expect(nightAlpha(0.5, na).night).toBe(0);
  });

  it('reaches full night (theme alpha x 1.08) at dot 0.10 - 0.44', () => {
    expect(nightAlpha(0.1 - 0.44, na).night).toBeCloseTo(na * 1.08, 9);
    expect(nightAlpha(-1, na).night).toBeCloseTo(na * 1.08, 9);
  });

  it('is a smoothstep in between (half way = half alpha)', () => {
    expect(nightAlpha(0.1 - 0.22, na).night).toBeCloseTo((na * 1.08) / 2, 9);
    // smoothstep(0.25) = 0.15625
    expect(nightAlpha(0.1 - 0.11, na).night).toBeCloseTo(na * 1.08 * 0.15625, 9);
  });

  it('peaks the dusk band at dot -0.01 with alpha 0.13 and fades out fast', () => {
    expect(nightAlpha(-0.01, na).dusk).toBeCloseTo(NIGHT.duskPeak, 9);
    expect(nightAlpha(-0.01 + 0.075, na).dusk).toBeCloseTo(0.13 * Math.exp(-1), 9);
    expect(nightAlpha(0.3, na).dusk).toBe(0);
    expect(nightAlpha(-0.32, na).dusk).toBe(0);
  });

  it('combines night and dusk as 1 - (1 - n)(1 - d)', () => {
    expect(combinedAlpha({ night: 0.5, dusk: 0.1 })).toBeCloseTo(0.55, 9);
  });

  it('keeps dusk subtle and night under the theme cap', () => {
    for (const scheme of ['light', 'dark'] as const) {
      let max = 0;
      for (let d = -1; d <= 1; d += 0.005) max = Math.max(max, combinedAlpha(nightAlpha(d, NIGHT_THEME[scheme].nightAlpha)));
      expect(max).toBeLessThanOrEqual(NIGHT_THEME[scheme].nightAlpha * 1.08 + 1e-9);
    }
  });
});

describe('sun geometry', () => {
  it('sunDot is 1 at the subsolar point and -1 at its antipode', () => {
    expect(sunDot([20, 10], [20, 10])).toBeCloseTo(1, 9);
    expect(sunDot([-160, -10], [20, 10])).toBeCloseTo(-1, 9);
  });

  it('sunViewVector points at the viewer when the camera looks at the sun', () => {
    const cam: GlobeCamera = { center: [20, 10], radius: 100 };
    const [x, y, z] = sunViewVector(cam, [20, 10]);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(1, 9);
    // Sun 90 deg east of the view center: on the right limb.
    const [x2, , z2] = sunViewVector({ center: [0, 0], radius: 100 }, [90, 0]);
    expect(x2).toBeCloseTo(1, 9);
    expect(z2).toBeCloseTo(0, 9);
  });
});

describe('recompute keying and throttle', () => {
  it('quantizes the sun to 0.1 deg', () => {
    expect(sunKey([12.34, -5.06])).toBe('12.3,-5.1');
    expect(sunKey([12.36, -5.04])).toBe('12.4,-5.0');
    expect(sunKey([179.97, 0])).toBe('-180.0,0.0');
    expect(sunKey([-0.01, -0.02])).toBe('0.0,0.0');
    expect(sunFromKey('12.3,-5.1')).toEqual([12.3, -5.1]);
  });

  it('changes key about every 24 s of real time, not every second', () => {
    const t = Date.UTC(2026, 9, 14, 12, 0, 0);
    const keys = new Set<string>();
    for (let s = 0; s < 60; s++) keys.add(sunKey(sunPosition(t + s * 1000)));
    // 60 s = 0.25 deg of longitude => 2 to 4 distinct keys.
    expect(keys.size).toBeGreaterThanOrEqual(2);
    expect(keys.size).toBeLessThanOrEqual(4);
    // Same key within a few seconds.
    expect(sunKey(sunPosition(t))).toBe(sunKey(sunPosition(t + 500)));
  });
});
