/**
 * The save tear as bent paper (round 132, John: "if I was holding it in my hands and tore the paper
 * horizontally the paper would pull back (arc) and tear").
 */
import { SETTLE_MS } from '../TearAway';
import {
  dragMs,
  dragProgress,
  poseAt,
  raggedAt,
  RIP_END_MS,
  RIP_START_MS,
  shouldCommit,
  stepDrive,
  TEAR_DRAG,
  TEAR_MESH,
  TEAR_TOTAL_MS,
  tearMesh,
  ticksCrossed,
  tornAt,
  type TearDrive,
  type TearPose,
} from '../tearMesh';

const g = { width: 358, height: 330, perf: 96, toX: 179, toY: 600 };
const pose = (p: Partial<TearPose>): TearPose => ({ lift: 0, pull: 0, tear: 0, free: 0, fly: 0, ...p });
const row = (part: { positions: { x: number; y: number }[] }, j: number) =>
  part.positions.slice(j * (TEAR_MESH.cols + 1), (j + 1) * (TEAR_MESH.cols + 1));
const middle = (pts: { x: number; y: number }[]) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

describe('tearMesh: the stub torn off along the dashes (round 136, John: "just like a stub")', () => {
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

  it('never bends the card: the part under the dashes stays exactly where it is on screen', () => {
    for (const p of [
      {},
      { pull: 1 },
      { pull: 1, tear: 0.5 },
      { pull: 1, tear: 1, free: 1 },
      { pull: 1, tear: 1, free: 1, fly: 1 },
    ]) {
      const m = tearMesh(g, pose(p));
      m.body.positions.forEach((q, i) => {
        expect(q.x).toBeCloseTo(m.body.textures[i].x, 6);
        expect(q.y).toBeCloseTo(m.body.textures[i].y, 6);
      });
      expect(m.body.backIndices).toHaveLength(0);
      expect(m.stub.backIndices).toHaveLength(0);
    }
  });

  it('splits the picture on the dashed line, ragged but never more than a few points off it', () => {
    const m = tearMesh(g, pose({ pull: 1, tear: 0.5 }));
    const limit = TEAR_MESH.rag + TEAR_MESH.ragJitter / 2;
    for (const t of m.body.textures.slice(0, TEAR_MESH.cols + 1))
      expect(Math.abs(t.y - g.perf)).toBeLessThanOrEqual(limit + 1e-9);
    for (const t of m.stub.textures.slice(TEAR_MESH.stubRows * (TEAR_MESH.cols + 1)))
      expect(Math.abs(t.y - g.perf)).toBeLessThanOrEqual(limit + 1e-9);
    // Where it hasn't torn yet the stub is still on the card, right where it was.
    const edge = row(m.stub, TEAR_MESH.stubRows);
    const tex = m.stub.textures.slice(TEAR_MESH.stubRows * (TEAR_MESH.cols + 1));
    expect(edge[0].x).toBeCloseTo(tex[0].x, 6);
    expect(edge[0].y).toBeCloseTo(tex[0].y, 6);
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
    // The torn right end has tipped up off the line; the left is still on it.
    expect(gap(TEAR_MESH.cols)).toBeGreaterThan(gap(0) + 10);
    expect(gap(0)).toBeCloseTo(0, 6);
    // The first touch already nicks the right notch.
    const nicked = tearMesh(g, pose({ pull: 1 }));
    expect(nicked.edgeTorn[TEAR_MESH.cols]).toBeGreaterThan(0);
    expect(nicked.edgeTorn[0]).toBe(0);
  });

  it('once free the stub carries on up and to the left with the swipe, then flies into My Trips and fades', () => {
    const torn = middle(tearMesh(g, pose({ lift: 1, pull: 1, tear: 1 })).stub.positions);
    const free = middle(tearMesh(g, pose({ lift: 1, pull: 1, tear: 1, free: 1 })).stub.positions);
    expect(free.x).toBeLessThan(torn.x - 10);
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

describe('swipe to save drives the same tear (round 133, John)', () => {
  it('spends a sliver of the swipe nicking the notch, the rest ripping under the finger', () => {
    expect(TEAR_DRAG.lead).toBeLessThanOrEqual(0.1);
    expect(dragMs(0)).toBe(0);
    expect(dragMs(TEAR_DRAG.lead)).toBeCloseTo(RIP_START_MS);
    expect(dragMs(1)).toBeCloseTo(RIP_END_MS);
    for (let p = 0.05; p <= 1; p += 0.05) expect(dragMs(p)).toBeGreaterThan(dragMs(p - 0.05));
    expect(dragProgress(-1000, 300)).toBe(1);
    expect(dragProgress(40, 300)).toBe(0);
  });

  it('tears free well past halfway or on a hard flick past the middle, and lays back down otherwise (round 138)', () => {
    expect(shouldCommit(0.7, 0)).toBe(true);
    expect(shouldCommit(0.6, 0)).toBe(false);
    expect(shouldCommit(0.4, 0)).toBe(false);
    // A flick only counts once the pull is most of the way to the middle: a brush along the dashes doesn't save.
    expect(shouldCommit(0.4, -1)).toBe(false);
    expect(shouldCommit(0.5, -1)).toBe(true);
    expect(shouldCommit(0.05, -1)).toBe(false);
  });

  it('follows the finger, finishes on its own, and runs back down when cancelled', () => {
    const drag: TearDrive = { mode: 'drag', target: 500 };
    const a = stepDrive(0, drag, 16);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(500);
    expect(stepDrive(100, { mode: 'finish', target: 0 }, 16)).toBe(116);
    expect(stepDrive(10, { mode: 'cancel', target: 0 }, 16)).toBe(0);
    expect(stepDrive(TEAR_TOTAL_MS - 1, null, 16)).toBe(TEAR_TOTAL_MS);
  });

  it('ticks once as the notch gives and three times along the rip, only going forward', () => {
    expect(ticksCrossed(0, TEAR_TOTAL_MS)).toBe(4);
    expect(ticksCrossed(RIP_END_MS, 0)).toBe(0);
    expect(ticksCrossed(0, RIP_START_MS)).toBe(1);
  });
});

describe('the torn edge looks cut with a dull knife (round 135, John)', () => {
  const us = Array.from({ length: TEAR_MESH.cols + 1 }, (_, i) => i / TEAR_MESH.cols);
  const rags = us.map((u, i) => raggedAt(u, i));

  it('wanders off the line instead of running dead straight, but stays near the dashes', () => {
    const spread = Math.max(...rags) - Math.min(...rags);
    expect(spread).toBeGreaterThan(2);
    for (const r of rags) expect(Math.abs(r)).toBeLessThanOrEqual(TEAR_MESH.rag + TEAR_MESH.ragJitter / 2 + 1e-9);
    // Not a smooth curve either: neighbours jump about like fibres giving way.
    const jumps = rags.slice(1).filter((r, i) => Math.abs(r - rags[i]) > 0.3);
    expect(jumps.length).toBeGreaterThan(TEAR_MESH.cols / 4);
  });

  it('starts and ends on the notches at either side', () => {
    expect(rags[0]).toBe(0);
    expect(rags[rags.length - 1]).toBeCloseTo(0, 9);
  });

  it('is the same edge on both pieces, so they fit back together', () => {
    const m = tearMesh(g, pose({}));
    const bodyTop = m.body.textures.slice(0, TEAR_MESH.cols + 1);
    const stubBottom = m.stub.textures.slice(TEAR_MESH.stubRows * (TEAR_MESH.cols + 1));
    bodyTop.forEach((t, i) => {
      expect(t.y).toBeCloseTo(g.perf + rags[i], 6);
      expect(stubBottom[i].y).toBeCloseTo(t.y, 6);
    });
  });

  it('marks which bits of the edge have torn, for the paper fibres along it', () => {
    expect(tearMesh(g, pose({})).edgeTorn.every((t) => t === 0)).toBe(true);
    const half = tearMesh(g, pose({ lift: 1, pull: 1, tear: 0.5 })).edgeTorn;
    expect(half).toHaveLength(TEAR_MESH.cols + 1);
    // Swiping left: the right side has given way before the left.
    expect(half[half.length - 1]).toBeGreaterThan(half[0]);
    expect(tearMesh(g, pose({ tear: 1, free: 1 })).edgeTorn.every((t) => t === 1)).toBe(true);
  });
});
