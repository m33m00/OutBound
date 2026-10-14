/**
 * Radar overlay geometry and image cache (backlog item 14). Pure: no Skia,
 * no React, so it is unit tested directly. Skia drawing is in radarLayer.ts.
 *
 * Approach (design/research/radar.md, option A): each region image is plate
 * carree, so a grid of ~2 degree cells over its bbox is projected with the
 * globe's own orthographic projection, and each vertex gets a texture coord
 * linear in lon/lat. Skia then draws the triangles with the image as shader.
 *
 * Limb: a triangle is kept only if all three corners are on the visible
 * hemisphere, so no triangle ever spans the limb (no stretched slivers).
 * The gap this leaves at the limb is at most one cell, which the
 * orthographic projection squeezes to well under a point near the edge.
 */
import { geoRotation } from 'd3-geo';

import { projectionFor, type GlobeCamera, type Viewport } from './camera';
import type { RadarLayer } from './types';

export const RADAR = {
  /** Grid cell size in degrees (lon and lat). CONUS = 35 x 18 cells. */
  cellDeg: 2,
  /**
   * Overlay opacity (provisional, tune on device). Lower in dark: the NWS
   * reflectivity colors glow more over the dark globe. Arcs, chevrons,
   * marks and badges draw above the radar, so it never covers them.
   */
  opacity: { light: 0.6, dark: 0.5 },
  /** A vertex counts as visible when cos(angle from view center) is above this. */
  limbEpsilon: 1e-6,
} as const;

export interface Pt {
  x: number;
  y: number;
}

/** Triangles ready for Skia.MakeVertices (VertexMode.Triangles). */
export interface RadarMesh {
  positions: Pt[];
  /** Texture coords in image pixels (0..width, 0..height; row 0 = north). */
  texCoords: Pt[];
  /** Three per triangle, into positions/texCoords. */
  indices: number[];
}

export type RadarBBox = RadarLayer['bbox'];

/** Grid steps covering `span` degrees with cells no bigger than `cell`. */
function steps(span: number, cell: number): number {
  return Math.max(1, Math.ceil(span / cell - 1e-9));
}

/**
 * Mesh for one region image on the current camera, or null when nothing of
 * it is on screen. Vertices on the far side are dropped (with every
 * triangle that touches them); triangles fully off one side of the viewport
 * are culled; only used vertices are emitted.
 */
export function radarMesh(
  bbox: RadarBBox,
  camera: GlobeCamera,
  viewport: Viewport,
  image: { width: number; height: number },
  cellDeg: number = RADAR.cellDeg,
): RadarMesh | null {
  const [west, south, eastRaw, north] = bbox;
  const east = eastRaw < west ? eastRaw + 360 : eastRaw;
  const spanLon = east - west;
  const spanLat = north - south;
  if (!(spanLon > 0) || !(spanLat > 0) || !(image.width > 0) || !(image.height > 0)) return null;

  const nx = steps(spanLon, cellDeg);
  const ny = steps(spanLat, cellDeg);
  const projection = projectionFor(camera, viewport);
  const rotate = geoRotation([-camera.center[0], -camera.center[1], 0]);
  const toRad = Math.PI / 180;

  // Grid vertices, row 0 = north edge (image row 0).
  const cols = nx + 1;
  const count = cols * (ny + 1);
  const sx = new Float64Array(count);
  const sy = new Float64Array(count);
  const visible = new Uint8Array(count);
  for (let j = 0; j <= ny; j++) {
    const lat = north - (spanLat * j) / ny;
    for (let i = 0; i <= nx; i++) {
      const lon = west + (spanLon * i) / nx;
      const k = j * cols + i;
      const r = rotate([lon, lat]);
      const cosC = Math.cos(r[1] * toRad) * Math.cos(r[0] * toRad);
      if (cosC <= RADAR.limbEpsilon) continue;
      const p = projection([lon, lat]);
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      sx[k] = p[0];
      sy[k] = p[1];
      visible[k] = 1;
    }
  }

  const { width: W, height: H } = viewport;
  const offscreen = (a: number, b: number, c: number) =>
    (sx[a] < 0 && sx[b] < 0 && sx[c] < 0) ||
    (sy[a] < 0 && sy[b] < 0 && sy[c] < 0) ||
    (sx[a] > W && sx[b] > W && sx[c] > W) ||
    (sy[a] > H && sy[b] > H && sy[c] > H);

  const remap = new Int32Array(count).fill(-1);
  const positions: Pt[] = [];
  const texCoords: Pt[] = [];
  const indices: number[] = [];
  const use = (k: number) => {
    if (remap[k] < 0) {
      remap[k] = positions.length;
      positions.push({ x: sx[k], y: sy[k] });
      const i = k % cols;
      const j = (k - i) / cols;
      texCoords.push({ x: (image.width * i) / nx, y: (image.height * j) / ny });
    }
    indices.push(remap[k]);
  };
  const tri = (a: number, b: number, c: number) => {
    if (!visible[a] || !visible[b] || !visible[c] || offscreen(a, b, c)) return;
    use(a);
    use(b);
    use(c);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const tl = j * cols + i;
      const tr = tl + 1;
      const bl = tl + cols;
      const br = bl + 1;
      tri(tl, tr, br);
      tri(tl, br, bl);
    }
  }
  return indices.length > 0 ? { positions, texCoords, indices } : null;
}

/** Value key for a radar prop: same key = same images, no decode, no re-record. */
export function radarKey(layers: readonly RadarLayer[] | undefined): string {
  if (!layers || layers.length === 0) return '';
  return layers.map((l) => `${l.region}@${l.observedAt}[${l.bbox.join(',')}]`).join(';');
}

export interface DecodedRadar<I> {
  region: string;
  bbox: RadarBBox;
  image: I;
}

/**
 * Decoded radar images, one per region, keyed by region + observedAt.
 * A new observedAt decodes once and disposes the replaced image; regions
 * that disappear are disposed. A failed decode is remembered (null) so it
 * is not retried until observedAt changes. Decode/dispose are injected so
 * the cache is testable without Skia.
 */
export class RadarImageCache<I> {
  private entries = new Map<string, { observedAt: string; image: I | null }>();

  constructor(
    private readonly decode: (bytes: Uint8Array) => I | null,
    private readonly dispose: (image: I) => void,
  ) {}

  /** Images for `layers`, in input order (first entry wins per region). */
  sync(layers: readonly RadarLayer[] | undefined): DecodedRadar<I>[] {
    const out: DecodedRadar<I>[] = [];
    const seen = new Set<string>();
    for (const layer of layers ?? []) {
      if (seen.has(layer.region)) continue;
      seen.add(layer.region);
      let entry = this.entries.get(layer.region);
      if (!entry || entry.observedAt !== layer.observedAt) {
        if (entry?.image != null) this.dispose(entry.image);
        let image: I | null = null;
        try {
          image = this.decode(layer.bytes);
        } catch {
          image = null;
        }
        entry = { observedAt: layer.observedAt, image };
        this.entries.set(layer.region, entry);
      }
      if (entry.image != null) out.push({ region: layer.region, bbox: layer.bbox, image: entry.image });
    }
    for (const [region, entry] of this.entries) {
      if (seen.has(region)) continue;
      if (entry.image != null) this.dispose(entry.image);
      this.entries.delete(region);
    }
    return out;
  }

  /** Dispose everything (unmount). The cache can be used again afterwards. */
  clear(): void {
    for (const entry of this.entries.values()) {
      if (entry.image != null) this.dispose(entry.image);
    }
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Canvas layers, back to front: base, night (item 11), radar, routes, rim,
 * marks, plane (item 11). Night sits under radar so radar colors are never
 * tinted (Q-033). Radar is left out while a flight preview plays: it is a
 * "now" picture and would not match the simulated sky.
 */
export type CanvasLayerName = 'base' | 'night' | 'radar' | 'routes' | 'rim' | 'marks' | 'plane';

export function canvasLayerOrder(present: {
  night?: boolean;
  radar: boolean;
  routes: boolean;
  marks: boolean;
  plane?: boolean;
  previewing?: boolean;
}): CanvasLayerName[] {
  const order: CanvasLayerName[] = ['base'];
  if (present.night) order.push('night');
  if (present.radar && !present.previewing) order.push('radar');
  if (present.routes) order.push('routes');
  order.push('rim');
  if (present.marks) order.push('marks');
  if (present.plane) order.push('plane');
  return order;
}

/** Accessibility sentence, only when radar is drawn. */
export function radarSummary(layerCount: number): string | null {
  return layerCount > 0 ? 'Radar shown.' : null;
}
