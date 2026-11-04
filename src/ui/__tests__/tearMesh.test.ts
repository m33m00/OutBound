/**
 * The save tear as bent paper (round 132, John: "if I was holding it in my hands and tore the paper
 * horizontally the paper would pull back (arc) and tear").
 */
import { SETTLE_MS } from '../TearAway';
import { curlShare, poseAt, TEAR_MESH, TEAR_TOTAL_MS, tearMesh, tornAt, type TearPose } from '../tearMesh';

const g = { width: 358, height: 330, perf: 96, toX: 179, toY: 600 };
const pose = (p: Partial<TearPose>): TearPose => ({ lift: 0, pull: 0, tear: 0, free: 0, fly: 0, ...p });
const row = (part: { positions: { x: number; y: number }[] }, j: number) =>
  part.positions.slice(j * (TEAR_MESH.cols + 1), (j + 1) * (TEAR_MESH.cols + 1));
const middle = (pts: { x: number; y: number }[]) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

describe('tearMesh: the route card bent as paper (round 132)', () => {
  it('stays short with the settle: about a second and a half', () => {
    expect(TEAR_TOTAL_MS + SETTLE_MS).toBeLessThanOrEqual(1700);
  });

  it('starts as the flat card, every point where it is on the picture, all facing you', () => {
    const m = tearMesh(g, pose({}));
    for (const part of [m.body, m.stub]) {
      part.positions.forEach((p, i) => {
        expect(p.x).toBeCloseTo(part.textures[i].x, 6);
        expect(p.y).toBeCloseTo(part.textures[i].y, 6);
      });
      expect(part.backIndices).toHaveLength(0);
    }
    expect(m.stubOpacity).toBe(1);
  });

  it('curls on an exponential: flat at the line, harder toward the top edge', () => {
    expect(curlShare(0)).toBe(0);
    expect(curlShare(1)).toBeCloseTo(1, 9);
    expect(curlShare(0.5)).toBeLessThan(0.35);
  });

  it('rips from the right notch to the left', () => {
    expect(tornAt(0, 0)).toBe(0);
    expect(tornAt(1, 0)).toBe(0);
    expect(tornAt(0, 1)).toBe(1);
    expect(tornAt(0.9, 0.5)).toBeGreaterThan(tornAt(0.2, 0.5));
    // Mid-rip the stub's torn edge has let go of the line on the right but not yet on the left.
    const m = tearMesh(g, pose({ lift: 1, pull: 1, tear: 0.5 }));
    const edge = row(m.stub, TEAR_MESH.stubRows);
    const body = row(m.body, 0);
    const gap = (i: number) => body[i].y - edge[i].y;
    expect(gap(TEAR_MESH.cols)).toBeGreaterThan(gap(0) + 2);
  });

  it('pulled toward you, the top rolls over so its back shows, and the body stays face up', () => {
    const pulled = tearMesh(g, pose({ lift: 1, pull: 1, tear: 1 }));
    expect(pulled.stub.backIndices.length).toBeGreaterThan(0);
    expect(pulled.body.backIndices).toHaveLength(0);
    // Where the paper stands on edge in the roll it's turned from the light, so it's darker than the
    // flat part at the line.
    const shade = pulled.stub.shade;
    const n = TEAR_MESH.cols + 1;
    const rows = Array.from({ length: TEAR_MESH.stubRows + 1 }, (_, j) =>
      shade.slice(j * n, (j + 1) * n).reduce((a, b) => a + b, 0),
    );
    expect(Math.min(...rows)).toBeLessThan(rows[rows.length - 1] - 1);
  });

  it('once free the stub swings up and out to the right, then flies into My Trips and fades', () => {
    const torn = middle(tearMesh(g, pose({ lift: 1, pull: 1, tear: 1 })).stub.positions);
    const free = middle(tearMesh(g, pose({ lift: 1, pull: 1, tear: 1, free: 1 })).stub.positions);
    expect(free.x).toBeGreaterThan(torn.x + 10);
    expect(free.y).toBeLessThan(torn.y - 10);
    const landed = tearMesh(g, pose({ lift: 1, pull: 1, tear: 1, free: 1, fly: 1 }));
    const at = middle(landed.stub.positions);
    expect(at.x).toBeCloseTo(g.toX, 0);
    expect(at.y).toBeCloseTo(g.toY, 0);
    expect(landed.stubOpacity).toBeCloseTo(0, 9);
    // The card lies back down flat by then.
    landed.body.positions.forEach((p, i) => expect(p.y).toBeCloseTo(landed.body.textures[i].y, 6));
  });

  it('runs its steps in order', () => {
    expect(poseAt(0)).toEqual({ lift: 0, pull: 0, tear: 0, free: 0, fly: 0 });
    const end = poseAt(TEAR_TOTAL_MS);
    expect(end).toEqual({ lift: 1, pull: 1, tear: 1, free: 1, fly: 1 });
    const mid = poseAt(600);
    expect(mid.lift).toBe(1);
    expect(mid.pull).toBe(1);
    expect(mid.fly).toBe(0);
  });
});
