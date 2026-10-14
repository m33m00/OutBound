import { geoDistance } from 'd3-geo';

import { globeOrigin, projectionFor, type GlobeCamera, type Viewport } from '../camera';
import {
  canvasLayerOrder,
  radarKey,
  radarMesh,
  radarSummary,
  RadarImageCache,
  RADAR,
  type RadarBBox,
} from '../radar';
import type { RadarLayer } from '../types';

const vp: Viewport = { width: 400, height: 800, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
const CONUS: RadarBBox = [-130, 20, -60, 55];
const IMG = { width: 1536, height: 768 };
const overUS: GlobeCamera = { center: [-97, 38], radius: 180 };

describe('radarMesh', () => {
  it('builds a full ~2 degree grid with UVs linear in lon/lat', () => {
    const mesh = radarMesh(CONUS, overUS, vp, IMG)!;
    expect(mesh).not.toBeNull();
    // 70 x 35 degrees -> 35 x 18 cells (17.5 rounds up), 36 x 19 vertices.
    expect(mesh.positions).toHaveLength(36 * 19);
    expect(mesh.texCoords).toHaveLength(36 * 19);
    expect(mesh.indices).toHaveLength(35 * 18 * 2 * 3);
    expect(Math.max(...mesh.indices)).toBe(mesh.positions.length - 1);

    const projection = projectionFor(overUS, vp);
    const [west, south, east, north] = CONUS;
    mesh.positions.forEach((p, i) => {
      const ll = projection.invert!([p.x, p.y])!;
      const uv = mesh.texCoords[i];
      expect(uv.x).toBeCloseTo(((ll[0] - west) / (east - west)) * IMG.width, 6);
      expect(uv.y).toBeCloseTo(((north - ll[1]) / (north - south)) * IMG.height, 6);
    });
    const us = mesh.texCoords.map((t) => t.x);
    const vs = mesh.texCoords.map((t) => t.y);
    expect(Math.min(...us)).toBe(0);
    expect(Math.max(...us)).toBeCloseTo(IMG.width);
    expect(Math.min(...vs)).toBe(0);
    expect(Math.max(...vs)).toBeCloseTo(IMG.height);
  });

  it('cell size never exceeds the config', () => {
    const mesh = radarMesh([-164, 15, -151, 26], overUS, vp, { width: 1024, height: 866 })!;
    // Hawaii: 13 x 11 degrees -> 7 x 6 cells.
    expect(mesh.indices.length / 6).toBe(7 * 6);
    expect(RADAR.cellDeg).toBe(2);
  });

  it('draws nothing when the region is on the far side', () => {
    expect(radarMesh(CONUS, { center: [83, -38], radius: 180 }, vp, IMG)).toBeNull();
  });

  it('drops far-side vertices at the limb, so no triangle spans it', () => {
    // CONUS straddles the limb: lon -100 is 90 degrees from this center.
    const cam: GlobeCamera = { center: [-10, 0], radius: 180 };
    const full = radarMesh(CONUS, overUS, vp, IMG)!;
    const mesh = radarMesh(CONUS, cam, vp, IMG)!;
    expect(mesh).not.toBeNull();
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeLessThan(full.indices.length);

    const projection = projectionFor(cam, vp);
    const o = globeOrigin(vp);
    for (const p of mesh.positions) {
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeLessThanOrEqual(cam.radius + 1e-6);
      const ll = projection.invert!([p.x, p.y])!;
      expect(geoDistance(ll, cam.center as [number, number])).toBeLessThan(Math.PI / 2);
    }
    // No stretched triangle: every edge is at most about one cell diagonal on screen.
    const maxEdge = cam.radius * ((Math.SQRT2 * RADAR.cellDeg * Math.PI) / 180) * 1.01;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => mesh.positions[mesh.indices[t + k]]);
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThanOrEqual(maxEdge);
      }
    }
  });

  it('culls triangles off screen when zoomed in', () => {
    const zoomed: GlobeCamera = { center: [-97, 38], radius: 400 * 6 };
    const full = radarMesh(CONUS, overUS, vp, IMG)!;
    const mesh = radarMesh(CONUS, zoomed, vp, IMG)!;
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeLessThan(full.indices.length / 2);
    expect(mesh.positions.length).toBeLessThan(full.positions.length);
  });

  it('handles a box across the antimeridian', () => {
    const mesh = radarMesh([170, 50, -170, 60], { center: [180, 55], radius: 300 }, vp, {
      width: 400,
      height: 200,
    })!;
    // 20 x 10 degrees -> 10 x 5 cells.
    expect(mesh.indices.length / 6).toBe(10 * 5);
  });

  it('returns null for an empty box or image', () => {
    expect(radarMesh([-100, 30, -100, 40], overUS, vp, IMG)).toBeNull();
    expect(radarMesh([-100, 40, -90, 30], overUS, vp, IMG)).toBeNull();
    expect(radarMesh(CONUS, overUS, vp, { width: 0, height: 10 })).toBeNull();
  });
});

function layer(region: string, observedAt: string, byte = 1): RadarLayer {
  return { region, bbox: CONUS, observedAt, bytes: new Uint8Array([byte]) };
}

function fakeCache(fail = false) {
  const decoded: string[] = [];
  const disposed: string[] = [];
  let n = 0;
  const cache = new RadarImageCache<{ id: string }>(
    (bytes) => {
      if (fail) return null;
      const id = `img${++n}:${bytes[0]}`;
      decoded.push(id);
      return { id };
    },
    (img) => disposed.push(img.id),
  );
  return { cache, decoded, disposed };
}

describe('RadarImageCache', () => {
  it('draws nothing for undefined or empty radar', () => {
    const { cache, decoded } = fakeCache();
    expect(cache.sync(undefined)).toEqual([]);
    expect(cache.sync([])).toEqual([]);
    expect(decoded).toEqual([]);
    expect(radarKey(undefined)).toBe('');
    expect(radarKey([])).toBe('');
  });

  it('decodes once per region + observedAt and reuses on a new array', () => {
    const { cache, decoded, disposed } = fakeCache();
    const a = cache.sync([layer('conus', 't1'), layer('ak', 't1')]);
    const b = cache.sync([layer('conus', 't1'), layer('ak', 't1')]);
    expect(decoded).toHaveLength(2);
    expect(disposed).toEqual([]);
    expect(b.map((d) => d.image)).toEqual(a.map((d) => d.image));
    expect(b[0].image).toBe(a[0].image);
  });

  it('disposes the replaced image when observedAt changes', () => {
    const { cache, decoded, disposed } = fakeCache();
    const [first] = cache.sync([layer('conus', 't1', 1)]);
    const [second] = cache.sync([layer('conus', 't2', 2)]);
    expect(decoded).toEqual(['img1:1', 'img2:2']);
    expect(disposed).toEqual([first.image.id]);
    expect(second.image.id).toBe('img2:2');
  });

  it('disposes regions that disappear and everything on clear', () => {
    const { cache, disposed } = fakeCache();
    cache.sync([layer('conus', 't1'), layer('hi', 't1')]);
    cache.sync([layer('conus', 't1')]);
    expect(disposed).toEqual(['img2:1']);
    expect(cache.size).toBe(1);
    cache.sync([]);
    expect(disposed).toEqual(['img2:1', 'img1:1']);
    cache.sync([layer('carib', 't1')]);
    cache.clear();
    expect(disposed).toHaveLength(3);
    expect(cache.size).toBe(0);
  });

  it('remembers a failed decode until observedAt changes', () => {
    let calls = 0;
    const cache = new RadarImageCache<object>(
      () => {
        calls++;
        throw new Error('bad png');
      },
      () => undefined,
    );
    expect(cache.sync([layer('conus', 't1')])).toEqual([]);
    expect(cache.sync([layer('conus', 't1')])).toEqual([]);
    expect(calls).toBe(1);
    cache.sync([layer('conus', 't2')]);
    expect(calls).toBe(2);
  });

  it('keeps the first entry when a region repeats', () => {
    const { cache, decoded } = fakeCache();
    const out = cache.sync([layer('conus', 't1', 1), layer('conus', 't9', 9)]);
    expect(out).toHaveLength(1);
    expect(decoded).toEqual(['img1:1']);
  });

  it('radarKey changes with observedAt, region or bbox, not bytes', () => {
    const k = radarKey([layer('conus', 't1', 1)]);
    expect(radarKey([layer('conus', 't1', 7)])).toBe(k);
    expect(radarKey([layer('conus', 't2')])).not.toBe(k);
    expect(radarKey([layer('ak', 't1')])).not.toBe(k);
    expect(radarKey([{ ...layer('conus', 't1'), bbox: [-131, 20, -60, 55] }])).not.toBe(k);
  });
});

describe('canvasLayerOrder', () => {
  it('puts radar above the static base and below routes, rim and marks', () => {
    expect(canvasLayerOrder({ radar: true, routes: true, marks: true })).toEqual([
      'base',
      'radar',
      'routes',
      'rim',
      'marks',
    ]);
    expect(canvasLayerOrder({ radar: true, routes: false, marks: false })).toEqual(['base', 'radar', 'rim']);
    expect(canvasLayerOrder({ radar: false, routes: true, marks: true })).toEqual([
      'base',
      'routes',
      'rim',
      'marks',
    ]);
  });
});

describe('radarSummary', () => {
  it('speaks only when radar is drawn', () => {
    expect(radarSummary(0)).toBeNull();
    expect(radarSummary(2)).toBe('Radar shown.');
  });
});

describe('RADAR config', () => {
  it('opacity is partial and lower in dark', () => {
    expect(RADAR.opacity.light).toBeGreaterThan(0);
    expect(RADAR.opacity.light).toBeLessThan(1);
    expect(RADAR.opacity.dark).toBeLessThanOrEqual(RADAR.opacity.light);
  });
});
