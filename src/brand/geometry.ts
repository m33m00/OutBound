import { PLANE_OUTLINE, TRAIL, type Pt, type Trail } from './jauntMark';

/**
 * The contrail band from its tail to `share` of the way to its head (0 to 1), widening as it goes,
 * as four corners. At share 1 it's the finished band.
 */
export function trailPolygon(share = 1, trail: Trail = TRAIL): Pt[] {
  const { tail, head, w0, w1 } = trail;
  const s = share < 0 ? 0 : share > 1 ? 1 : share;
  const len = Math.hypot(head.x - tail.x, head.y - tail.y);
  const nx = -(head.y - tail.y) / len;
  const ny = (head.x - tail.x) / len;
  const tip = { x: tail.x + (head.x - tail.x) * s, y: tail.y + (head.y - tail.y) * s };
  const w = w0 + (w1 - w0) * s;
  return [
    { x: tail.x + (nx * w0) / 2, y: tail.y + (ny * w0) / 2 },
    { x: tip.x + (nx * w) / 2, y: tip.y + (ny * w) / 2 },
    { x: tip.x - (nx * w) / 2, y: tip.y - (ny * w) / 2 },
    { x: tail.x - (nx * w0) / 2, y: tail.y - (ny * w0) / 2 },
  ];
}

/** Where the plane's centre sits when the band has drawn `share` of the way: just ahead of the tip. */
export function planeCenterAt(share = 1, trail: Trail = TRAIL): Pt {
  const s = share < 0 ? 0 : share > 1 ? 1 : share;
  const back = { x: trail.plane.x - trail.head.x, y: trail.plane.y - trail.head.y };
  return {
    x: trail.tail.x + (trail.head.x - trail.tail.x) * s + back.x,
    y: trail.tail.y + (trail.head.y - trail.tail.y) * s + back.y,
  };
}

/** The plane's outline with its centre at `at`, pointing along `heading`. */
export function planePolygon(at: Pt, heading: number = TRAIL.heading, scale: number = TRAIL.planeScale): Pt[] {
  // The outline is drawn nose up (-90°), so turn it by heading + 90°.
  const a = heading + Math.PI / 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return PLANE_OUTLINE.map(([x, y]) => ({ x: at.x + (x * cos - y * sin) * scale, y: at.y + (x * sin + y * cos) * scale }));
}

/** Points as an SVG path string, for Skia. */
export const polygonPath = (pts: Pt[]) => `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`;
