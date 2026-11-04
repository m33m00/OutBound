/**
 * The save tear as real bent paper (round 132, John: "it's very 2D still… if I was holding it in my
 * hands and tore the paper horizontally the paper would pull back (arc) and tear"). Pure maths, no
 * Skia: a picture of the route card is laid on a fine grid, the grid is bent in 3D, seen in
 * perspective and shaded by how each bit of paper faces the light, so the curve reads as a curve.
 *
 * - Picked up: the card tips back in your hands and bows a little across its width.
 * - Pulled: the stub above the perforation curls up toward you on an exponential arc, flat at the line
 *   and curling harder toward its top edge.
 * - Torn: the rip runs from the right notch to the left. Each torn stretch lets go of the line and
 *   curls further, so the tear front is a real twist in the paper.
 * - Free: the stub swings up and out to the right, turning a little.
 * - Flight: the stub shrinks into My Trips while the card lies back down.
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
  | 'cols'
  | 'stubRows'
  | 'bodyRows'
  | 'perspective'
  | 'tiltX'
  | 'tiltY'
  | 'bow'
  | 'curlDeg'
  | 'growth'
  | 'pullShare'
  | 'front'
  | 'detachUp'
  | 'detachOut'
  | 'freeDeg'
  | 'freeX'
  | 'freeY'
  | 'freeOut'
  | 'tug'
  | 'rag'
  | 'ragJitter',
  number
>;

export const TEAR_MESH: TearMeshConfig = {
  // Fine across, so the torn edge can be ragged (round 135).
  cols: 48,
  stubRows: 10,
  bodyRows: 12,
  perspective: 720,
  /** How far the card tips back and turns in your hands, in degrees. */
  tiltX: 14,
  tiltY: -22,
  /** How much the card bows across its width, in points toward you at the middle. */
  bow: 10,
  /** The curl: its full turn at the stub's top edge, and how sharply it grows toward that edge. */
  curlDeg: 150,
  growth: 2.2,
  /** Share of the curl from the pull alone, before the rip lets that stretch go. */
  pullShare: 0.55,
  /** How wide the tear front is, as a share of the card's width. */
  front: 0.22,
  /** A torn stretch lifts off the line by this much (points up, points toward you). */
  detachUp: 4,
  detachOut: 9,
  /** Once free: the swing up and out to the right. */
  freeDeg: 14,
  freeX: 50,
  freeY: -38,
  freeOut: 30,
  /** The bottom half gives a little the other way while the rip runs. */
  tug: 5,
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

type V3 = { x: number; y: number; z: number };

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** The curl's turn at a share `at` of the way up the stub, as a share of the full turn. */
export function curlShare(at: number, growth: number = TEAR_MESH.growth): number {
  return (Math.exp(growth * at) - 1) / (Math.exp(growth) - 1);
}

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

/**
 * Splits triangles by which way they face on screen: past upright the curl shows the back of the
 * paper. The stub is drawn from the line upward, so the part that rolls over toward you draws last.
 */
function facing(positions: { x: number; y: number }[], indices: number[], bottomUp: boolean): [number[], number[]] {
  const front: number[] = [];
  const back: number[] = [];
  const tris: number[][] = [];
  for (let k = 0; k < indices.length; k += 3) tris.push(indices.slice(k, k + 3));
  if (bottomUp) tris.reverse();
  for (const [a, b, c] of tris) {
    const p = positions[a];
    const q = positions[b];
    const r = positions[c];
    const area = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    (area >= 0 ? front : back).push(a, b, c);
  }
  return [front, back];
}

function shadeOf(points: V3[], cols: number, rows: number): number[] {
  const w = cols + 1;
  const L = { x: -0.32, y: -0.5, z: 0.8 };
  const ll = Math.hypot(L.x, L.y, L.z);
  const at = (i: number, j: number) => points[Math.max(0, Math.min(rows, j)) * w + Math.max(0, Math.min(cols, i))];
  const out: number[] = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const a = at(i + 1, j);
      const b = at(i - 1, j);
      const c = at(i, j + 1);
      const d = at(i, j - 1);
      const tx = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
      const ty = { x: c.x - d.x, y: c.y - d.y, z: c.z - d.z };
      let n = { x: tx.y * ty.z - tx.z * ty.y, y: tx.z * ty.x - tx.x * ty.z, z: tx.x * ty.y - tx.y * ty.x };
      const nl = Math.hypot(n.x, n.y, n.z) || 1;
      // The back of the paper faces you once it rolls over; light it the same way.
      const flip = n.z < 0 ? -1 : 1;
      n = { x: (flip * n.x) / nl, y: (flip * n.y) / nl, z: (flip * n.z) / nl };
      const lit = (n.x * L.x + n.y * L.y + n.z * L.z) / ll;
      // Square on to the viewer reads as 1; paper turned from the light darkens, never below 0.55.
      out.push(Math.max(0.55, Math.min(1, 0.3 + (0.7 * lit) / (L.z / ll))));
    }
  }
  return out;
}

/** The whole picture of the tear at one moment. */
export function tearMesh(g: TearGeometry, pose: TearPose, m: TearMeshConfig = TEAR_MESH): TearMesh {
  const { width: W, height: H, perf } = g;
  const held = clamp01(pose.lift) * (1 - smooth(pose.fly));
  const ax = (m.tiltX * held * Math.PI) / 180;
  const ay = (m.tiltY * held * Math.PI) / 180;
  const cx = W / 2;
  const cy = H / 2;
  const view = (p: V3): V3 => {
    // In your hands: tipped back about the card's middle, then turned a little.
    let x = p.x - cx;
    let y = p.y - cy;
    let z = p.z;
    const y1 = y * Math.cos(ax) - z * Math.sin(ax);
    const z1 = y * Math.sin(ax) + z * Math.cos(ax);
    y = y1;
    z = z1;
    const x2 = x * Math.cos(ay) + z * Math.sin(ay);
    const z2 = -x * Math.sin(ay) + z * Math.cos(ay);
    x = x2;
    z = z2;
    return { x, y, z };
  };
  const project = (p: V3) => {
    const s = m.perspective / (m.perspective - p.z);
    return { x: cx + p.x * s, y: cy + p.y * s };
  };
  const bowAt = (u: number) => m.bow * held * (1 - (2 * u - 1) ** 2);
  const ripping = Math.sin(Math.PI * clamp01(pose.tear));

  // The bottom half, under the perforation.
  const bodyPts: V3[] = [];
  const bodyTex: { x: number; y: number }[] = [];
  for (let j = 0; j <= m.bodyRows; j++) {
    const row = perf + ((H - perf) * j) / m.bodyRows;
    const near = 1 - j / m.bodyRows;
    for (let i = 0; i <= m.cols; i++) {
      const u = i / m.cols;
      const x = W * u;
      // The top row is the torn edge.
      const y = j === 0 ? perf + raggedAt(u, i, m) : row;
      bodyPts.push({ x, y, z: bowAt(u) - m.tug * ripping * near * near });
      bodyTex.push({ x, y });
    }
  }

  // The stub, built from the line upward so each column curls as one strip of paper.
  const stubPts: V3[] = new Array((m.cols + 1) * (m.stubRows + 1));
  const stubTex: { x: number; y: number }[] = new Array(stubPts.length);
  const free = smooth(pose.free);
  const fa = (-m.freeDeg * free * Math.PI) / 180;
  const edgeTorn: number[] = [];
  for (let i = 0; i <= m.cols; i++) {
    const u = i / m.cols;
    const x = W * u;
    const torn = Math.max(tornAt(u, pose.tear), free);
    edgeTorn.push(torn);
    const k = m.pullShare * clamp01(pose.pull) + (1 - m.pullShare) * torn;
    // The stub's bottom is the same ragged edge as the body's top.
    const rag = raggedAt(u, i, m);
    // Each column's strip runs from the card's top down to its own bit of the ragged edge.
    const colSeg = Math.max(0, perf + rag) / m.stubRows;
    let y = perf + rag - m.detachUp * torn;
    let z = bowAt(u) + m.detachOut * torn;
    for (let j = m.stubRows; j >= 0; j--) {
      const idx = j * (m.cols + 1) + i;
      // Free: the stub turns about its bottom left and swings up and out to the right.
      const fx = x * Math.cos(fa) - (y - perf) * Math.sin(fa) + m.freeX * free;
      const fy = perf + x * Math.sin(fa) + (y - perf) * Math.cos(fa) + m.freeY * free;
      stubPts[idx] = { x: fx, y: fy, z: z + m.freeOut * free };
      stubTex[idx] = { x, y: colSeg * j };
      if (j === 0) break;
      const mid = (m.stubRows - j + 0.5) / m.stubRows;
      const turn = (k * m.curlDeg * curlShare(mid, m.growth) * Math.PI) / 180;
      y -= colSeg * Math.cos(turn);
      z += colSeg * Math.sin(turn);
    }
  }

  const bodyView = bodyPts.map(view);
  const stubView = stubPts.map(view);
  let stubPos = stubView.map(project);
  // The flight: shrink about the stub's middle on the way to My Trips.
  const fly = clamp01(pose.fly);
  if (fly > 0) {
    const e = fly * fly * fly;
    const mx = stubPos.reduce((s, p) => s + p.x, 0) / stubPos.length;
    const my = stubPos.reduce((s, p) => s + p.y, 0) / stubPos.length;
    const scale = 1 - 0.88 * e;
    const arc = -18 * Math.sin(Math.PI * Math.min(1, fly * 1.4));
    stubPos = stubPos.map((p) => ({
      x: mx + (p.x - mx) * scale + (g.toX - mx) * e,
      y: my + (p.y - my) * scale + (g.toY - my) * e + arc,
    }));
  }
  const bodyPos = bodyView.map(project);
  const [bodyFront, bodyBack] = facing(bodyPos, grid(m.cols, m.bodyRows), false);
  const [stubFront, stubBack] = facing(stubPos, grid(m.cols, m.stubRows), true);
  return {
    body: {
      positions: bodyPos,
      textures: bodyTex,
      shade: shadeOf(bodyView, m.cols, m.bodyRows),
      indices: bodyFront,
      backIndices: bodyBack,
    },
    stub: {
      positions: stubPos,
      textures: stubTex,
      shade: shadeOf(stubView, m.cols, m.stubRows),
      indices: stubFront,
      backIndices: stubBack,
    },
    edgeTorn,
    stubOpacity: fly < 0.8 ? 1 : 1 - (fly - 0.8) / 0.2,
  };
}

/** The pose at `ms` into the tear, with the lengths of each step. */
export const TEAR_STEPS = { lift: 180, pull: 300, hold: 50, tear: 360, free: 150, fly: 380 } as const;
export const TEAR_TOTAL_MS = Object.values(TEAR_STEPS).reduce((a, b) => a + b, 0);

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
  /** The share of the swipe that lifts and pulls before the rip starts. */
  lead: 0.22,
  /** How far left, as a share of the card's width, a full swipe is. */
  span: 0.78,
  /** Let go at or past this much of the swipe and it tears free. */
  commitAt: 0.6,
  /** Or flick left at least this fast (points per ms) once the rip has started. */
  flickVx: -0.5,
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
  return p >= TEAR_DRAG.commitAt || (vx <= TEAR_DRAG.flickVx && p > TEAR_DRAG.lead);
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
