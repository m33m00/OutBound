/**
 * The save tear as a ticket stub torn off along its perforation (round 136, John: "the bend back looks
 * bad. Can it just be like a stub we're cutting back?"). Flat, like the card on screen: a picture of the
 * route card is laid on a fine grid and only the stub above the dashed line moves, so the rip stays on
 * the dashes wherever the card is. Pure maths, no Skia.
 *
 * - Nicked: the right notch gives first, so the stub's corner lifts off the line as the finger starts.
 * - Torn: the rip runs from the right notch to the left; the torn stretch tips up off the line about
 *   the tear front, like a stub being torn back, with a ragged edge on both pieces (round 135).
 * - Free: the stub lets go at the left notch and carries on up and to the left with the swipe.
 * - Flight: the stub shrinks into My Trips; the card under it never moves.
 */

export interface TearPose {
  /** Each 0 to 1, in the order they run. */
  lift: number;
  pull: number;
  tear: number;
  free: number;
  fly: number;
}

export interface TearGeometry {
  /** The card's size in points, and how far down the perforation is. */
  width: number;
  height: number;
  perf: number;
  /** Where the stub's middle lands at the end of the flight, from the card's top left. */
  toX: number;
  toY: number;
}

export interface MeshPart {
  /** Screen points, from the card's top left. */
  positions: { x: number; y: number }[];
  /** Points on the card picture (in points; scale to the picture's pixels when drawing). */
  textures: { x: number; y: number }[];
  /** Light on each vertex, 0 to 1 (1 = facing the light square on). */
  shade: number[];
  /** Triangles facing you, drawn with the card picture, and those turned over, drawn as the plain back. */
  indices: number[];
  backIndices: number[];
}

export interface TearMesh {
  body: MeshPart;
  stub: MeshPart;
  /**
   * The torn edge (round 135): how far each column has let go (0 to 1). The body's edge is its top row
   * (vertices 0 to cols), the stub's its bottom row (vertices stubRows * (cols + 1) on).
   */
  edgeTorn: number[];
  /** The stub's opacity (it fades as it lands). */
  stubOpacity: number;
}

export type TearMeshConfig = Record<
  'cols' | 'stubRows' | 'bodyRows' | 'front' | 'nick' | 'peelDeg' | 'gapUp' | 'freeX' | 'freeY' | 'rag' | 'ragJitter',
  number
>;

export const TEAR_MESH: TearMeshConfig = {
  // Fine across, so the torn edge can be ragged (round 135).
  cols: 48,
  stubRows: 6,
  bodyRows: 2,
  /** How wide the tear front is, as a share of the card's width. */
  front: 0.18,
  /** How far along the rip the first touch nicks the right notch. */
  nick: 0.06,
  /** The torn stretch tips up off the line by up to this, about the tear front. */
  peelDeg: 7,
  /** And lifts clear of the line by this much, so the ragged gap shows. */
  gapUp: 3,
  /** Once free: up and to the left, with the swipe. */
  freeX: -26,
  freeY: -22,
  /**
   * The torn edge isn't a clean line (round 135, John: "like if I had cut paper with a dull knife"): it
   * wanders up and down the perforation by up to `rag` points, with sharp little jags of `ragJitter`.
   */
  rag: 3,
  ragJitter: 2.2,
};

/** A steady pseudo-random 0 to 1 for column `i`, so the same card always tears the same way. */
export function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Where the torn edge runs at `u` across, as points below the perforation's middle (negative is above).
 * Both pieces share it, so they fit back together like real torn paper.
 */
export function raggedAt(u: number, i: number, m: TearMeshConfig = TEAR_MESH): number {
  const wander =
    0.55 * Math.sin(2 * Math.PI * (u * 3.3 + 0.21)) +
    0.3 * Math.sin(2 * Math.PI * (u * 8.7 + 0.63)) +
    0.15 * Math.sin(2 * Math.PI * (u * 19.4 + 0.07));
  // The ends sit on the notches, where the dull knife starts and finishes.
  const ends = Math.min(1, u * 12, (1 - u) * 12);
  return ends * (m.rag * wander + m.ragJitter * (hash01(i) - 0.5));
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** How far the rip has let go of the paper at a point `u` across (0 left, 1 right): right first. */
export function tornAt(u: number, tear: number, front: number = TEAR_MESH.front): number {
  const edge = 1 - tear * (1 + front);
  return smooth((u - edge) / front);
}

function grid(cols: number, rows: number): number[] {
  const out: number[] = [];
  const w = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * w + i;
      out.push(a, a + 1, a + w, a + 1, a + w + 1, a + w);
    }
  }
  return out;
}

/** How far the rip has run at this pose, the first touch's nick included. */
export function ripAt(pose: TearPose, m: TearMeshConfig = TEAR_MESH): number {
  const tear = clamp01(pose.tear);
  return clamp01(tear + m.nick * smooth(pose.pull) * (1 - tear));
}

/** The whole picture of the tear at one moment. */
export function tearMesh(g: TearGeometry, pose: TearPose, m: TearMeshConfig = TEAR_MESH): TearMesh {
  const { width: W, height: H, perf } = g;
  const w = m.cols + 1;
  const rip = ripAt(pose, m);
  // The tear front: where the paper still holds, on the line.
  const pivotX = W * clamp01(1 - rip * (1 + m.front));
  const peel = (m.peelDeg * Math.PI) / 180;
  const free = smooth(pose.free);

  // The card under the perforation never moves; its top row is the ragged edge.
  const bodyPos: { x: number; y: number }[] = [];
  for (let j = 0; j <= m.bodyRows; j++) {
    for (let i = 0; i <= m.cols; i++) {
      const u = i / m.cols;
      const top = perf + raggedAt(u, i, m);
      bodyPos.push({ x: W * u, y: top + ((H - top) * j) / m.bodyRows });
    }
  }

  // The stub, from the card's top down to the same ragged edge.
  const stubTex: { x: number; y: number }[] = new Array(w * (m.stubRows + 1));
  const stubPos: { x: number; y: number }[] = new Array(stubTex.length);
  const edgeTorn: number[] = [];
  for (let i = 0; i <= m.cols; i++) {
    const u = i / m.cols;
    const x = W * u;
    const torn = tornAt(u, rip, m.front);
    edgeTorn.push(torn);
    const bottom = Math.max(0, perf + raggedAt(u, i, m));
    // Torn stretches tip up about the front; once free the whole stub holds the full tip.
    const a = peel * Math.max(torn, free);
    const lift = m.gapUp * Math.max(torn, free);
    const cx = pivotX * (1 - free);
    for (let j = 0; j <= m.stubRows; j++) {
      const idx = j * w + i;
      const y = (bottom * j) / m.stubRows;
      stubTex[idx] = { x, y };
      const rx = x - cx;
      const ry = y - perf;
      stubPos[idx] = {
        x: cx + rx * Math.cos(a) + ry * Math.sin(a) + m.freeX * free,
        y: perf - rx * Math.sin(a) + ry * Math.cos(a) - lift + m.freeY * free,
      };
    }
  }

  // The flight: shrink about the stub's middle on the way to My Trips.
  let flown = stubPos;
  const fly = clamp01(pose.fly);
  if (fly > 0) {
    const e = fly * fly * fly;
    const mx = stubPos.reduce((s, p) => s + p.x, 0) / stubPos.length;
    const my = stubPos.reduce((s, p) => s + p.y, 0) / stubPos.length;
    const scale = 1 - 0.88 * e;
    const arc = -18 * Math.sin(Math.PI * Math.min(1, fly * 1.4));
    flown = stubPos.map((p) => ({
      x: mx + (p.x - mx) * scale + (g.toX - mx) * e,
      y: my + (p.y - my) * scale + (g.toY - my) * e + arc,
    }));
  }
  const flat = (n: number) => new Array<number>(n).fill(1);
  return {
    body: {
      positions: bodyPos,
      textures: bodyPos.map((p) => ({ ...p })),
      shade: flat(bodyPos.length),
      indices: grid(m.cols, m.bodyRows),
      backIndices: [],
    },
    stub: {
      positions: flown,
      textures: stubTex,
      shade: flat(flown.length),
      indices: grid(m.cols, m.stubRows),
      backIndices: [],
    },
    edgeTorn,
    stubOpacity: fly < 0.8 ? 1 : 1 - (fly - 0.8) / 0.2,
  };
}

/** The pose at `ms` into the tear, with the lengths of each step. */
export const TEAR_STEPS = { lift: 40, pull: 90, hold: 0, tear: 380, free: 170, fly: 380 } as const;
export const TEAR_TOTAL_MS = Object.values(TEAR_STEPS).reduce<number>((a, b) => a + b, 0);

export function poseAt(ms: number, s: typeof TEAR_STEPS = TEAR_STEPS): TearPose {
  let t = ms;
  const step = (len: number) => {
    const v = clamp01(t / len);
    t -= len;
    return v;
  };
  const lift = step(s.lift);
  const pull = step(s.pull);
  step(s.hold);
  const tear = step(s.tear);
  const free = step(s.free);
  const fly = step(s.fly);
  // Ease each: the pull comes up slowly then fast; the rip runs steady; the flight speeds up.
  return {
    lift: 1 - (1 - lift) ** 2,
    pull: pull ** 2.2,
    tear: smooth(tear),
    free,
    fly,
  };
}

/**
 * Swipe to save (round 133, John: "can it be swipe left on the perforation to save the flight? It rips
 * away and looks realistic"). Your finger runs the same tear: the first part of the swipe picks the card
 * up and pulls the stub toward you, the rest rips it along the perforation from the right notch, right
 * under your finger. Let go past the middle of the rip (or flick left) and it tears free and flies to
 * My Trips; let go sooner and the paper lays back down.
 */
export const RIP_START_MS = TEAR_STEPS.lift + TEAR_STEPS.pull + TEAR_STEPS.hold;
export const RIP_END_MS = RIP_START_MS + TEAR_STEPS.tear;
export const TEAR_DRAG = {
  /** The share of the swipe that nicks the notch before the rip runs. */
  lead: 0.08,
  /** How far left, as a share of the card's width, a full swipe is. */
  span: 0.78,
  /** Let go at or past this much of the swipe and it tears free. Well past halfway (round 138, John: page swipes
   *  saved routes by accident), so a short brush along the dashes lays back down. */
  commitAt: 0.7,
  /** Or flick left at least this fast (points per ms) once the pull is this far along. */
  flickVx: -0.5,
  flickFrom: 0.45,
  /** How fast the paper follows your finger (ms to close most of the gap), and how fast it lays back down. */
  follow: 60,
  backRate: 1.6,
} as const;

/** How far through the swipe a finger is, 0 to 1, from how far it moved left across a card `width` wide. */
export function dragProgress(dx: number, width: number): number {
  if (width <= 0) return 0;
  return clamp01(-dx / (width * TEAR_DRAG.span));
}

/** The point in the tear a swipe this far through shows. */
export function dragMs(p: number): number {
  const q = clamp01(p);
  return q <= TEAR_DRAG.lead
    ? (q / TEAR_DRAG.lead) * RIP_START_MS
    : RIP_START_MS + ((q - TEAR_DRAG.lead) / (1 - TEAR_DRAG.lead)) * TEAR_STEPS.tear;
}

/** Whether letting go here tears it free (true) or lays it back down (false). */
export function shouldCommit(p: number, vx: number): boolean {
  return p >= TEAR_DRAG.commitAt || (vx <= TEAR_DRAG.flickVx && p >= TEAR_DRAG.flickFrom);
}

/** Who moves the paper: your finger, the finish once you let go, or the paper laying back down. */
export interface TearDrive {
  mode: 'drag' | 'finish' | 'cancel';
  /** Where your finger has the tear, in ms (drag only). */
  target: number;
}

/** The next frame's point in the tear, `dt` ms after one at `ms`. */
export function stepDrive(ms: number, drive: TearDrive | null | undefined, dt: number): number {
  if (!drive || drive.mode === 'finish') return Math.min(TEAR_TOTAL_MS, ms + dt);
  if (drive.mode === 'cancel') return Math.max(0, ms - dt * TEAR_DRAG.backRate);
  const k = Math.min(1, dt / TEAR_DRAG.follow);
  return ms + (drive.target - ms) * k;
}

/** Haptic ticks: one as the paper comes up taut, then three along the rip. */
export const TEAR_TICKS = [
  RIP_START_MS - TEAR_STEPS.hold - 20,
  ...[0, 1, 2].map((i) => RIP_START_MS + (i * TEAR_STEPS.tear) / 3 + 40),
];

/** How many ticks the tear passed going forward from `from` to `to`. */
export function ticksCrossed(from: number, to: number): number {
  return to <= from ? 0 : TEAR_TICKS.filter((t) => t > from && t <= to).length;
}
