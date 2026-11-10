/**
 * The launch intro's motion, as plain maths so it can be tested without a phone.
 *
 * Story (App Store round 1, 2026-11-06, John: "a loading screen when you open the app ... get
 * creative"): the app icon comes to life. The amber "you" dot pops in, the white route draws up
 * and to the right with the plane riding its tip, the OUTBOUND wordmark clicks in letter by letter
 * like a split-flap departure board, then the plane takes off along its heading and the blue
 * panel lifts away like a gate door, uncovering the app already waiting underneath.
 *
 * Every shape uses the icon's own numbers (design/assets/make-icon.py, 1024 canvas), so the intro
 * and the home screen icon are the same drawing.
 */

export type Point = { x: number; y: number };

/** The icon's route: a cubic curve from the origin dot to where the plane sits. */
export const ICON = {
  start: { x: 300, y: 735 },
  c1: { x: 300, y: 480 },
  c2: { x: 470, y: 330 },
  end: { x: 668, y: 312 },
  /** Route stroke width and the dot's white ring and amber center, as radii. */
  stroke: 52,
  ring: 62,
  dot: 38,
  planeScale: 0.95,
} as const;

/** Right half of the plane, nose up, in plane units (mirrored for the left half). */
const PLANE_RIGHT: readonly [number, number][] = [
  [0, -118],
  [15, -104],
  [17, -34],
  [112, 22],
  [112, 44],
  [17, 22],
  [14, 72],
  [46, 96],
  [46, 112],
  [0, 100],
];
/** The whole plane outline, nose up, centred on its own middle. */
export const PLANE_OUTLINE: readonly [number, number][] = [
  ...PLANE_RIGHT,
  ...PLANE_RIGHT.slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as [number, number]),
];
/** The plane's centre sits this far ahead of the route's end, so its tail meets the line. */
const PLANE_AHEAD = 70 * ICON.planeScale;

export const COLORS = {
  /** The icon's ink blue: the intro is the icon, so it stays this blue in light and dark mode. */
  panel: '#1D3D84',
  /** A split-flap tile, a step darker than the panel. */
  tile: '#15306A',
  tileEdge: 'rgba(0,0,0,0.32)',
  tileShine: 'rgba(255,255,255,0.06)',
  white: '#FFFFFF',
  /** The icon's amber: you. */
  amber: '#FFB25A',
} as const;

export const WORD = 'OUTBOUND';

/** When each part runs, in ms from the intro's first frame. */
export const TIMING = {
  dotIn: { start: 0, ms: 260 },
  draw: { start: 180, ms: 780 },
  /** First letter starts flipping here; the rest follow `letterGap` apart. */
  lettersStart: 620,
  letterGap: 70,
  /** How long a letter spins through other letters before it lands. */
  letterSpin: 300,
  /** A new letter shows this often while spinning, like a flap falling. */
  flapEvery: 50,
  /** The plane leaves and the panel lifts (round 169: a little longer so the lift glides). */
  exit: { start: 1800, ms: 640 },
  /** The panel starts lifting this long after the plane leaves. */
  liftDelay: 90,
  /** Reduce Motion: the finished picture holds, then fades. */
  reducedHold: 650,
  reducedFade: 300,
} as const;

/** Total length of the full intro; after this the overlay is gone. */
export const INTRO_MS = TIMING.exit.start + TIMING.exit.ms;
export const REDUCED_INTRO_MS = TIMING.reducedHold + TIMING.reducedFade;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (v: number) => 1 - (1 - clamp01(v)) ** 3;
export const easeInOutCubic = (v: number) => {
  const t = clamp01(v);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
export const easeInCubic = (v: number) => clamp01(v) ** 3;
/** A small overshoot for the dot popping in. */
export const easeOutBack = (v: number) => {
  const t = clamp01(v);
  const k = 1.70158;
  return 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
};

const progress = (t: number, start: number, ms: number) => clamp01((t - start) / ms);

/** A point on the icon's route at curve parameter u (0 = dot, 1 = plane). */
export function routePoint(u: number): Point {
  const v = 1 - u;
  const { start: s, c1, c2, end: e } = ICON;
  return {
    x: v * v * v * s.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * e.x,
    y: v * v * v * s.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * e.y,
  };
}

/** The route's heading at u, in radians (0 = right, clockwise positive since y points down). */
export function routeHeading(u: number): number {
  const v = 1 - u;
  const { start: s, c1, c2, end: e } = ICON;
  const dx = 3 * v * v * (c1.x - s.x) + 6 * v * u * (c2.x - c1.x) + 3 * u * u * (e.x - c2.x);
  const dy = 3 * v * v * (c1.y - s.y) + 6 * v * u * (c2.y - c1.y) + 3 * u * u * (e.y - c2.y);
  // At the very start the curve leaves straight up (c1 sits above the dot).
  if (dx === 0 && dy === 0) return -Math.PI / 2;
  return Math.atan2(dy, dx);
}

/** Arc-length table so "half drawn" means half the line's length, the way Skia trims a path. */
const SAMPLES = 240;
const LENGTHS: number[] = (() => {
  const out = [0];
  let prev = routePoint(0);
  for (let i = 1; i <= SAMPLES; i += 1) {
    const p = routePoint(i / SAMPLES);
    out.push(out[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  return out;
})();
export const ROUTE_LENGTH = LENGTHS[SAMPLES];

/** The curve parameter at a share (0 to 1) of the route's length. */
export function paramAtLength(share: number): number {
  const target = clamp01(share) * ROUTE_LENGTH;
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (LENGTHS[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = LENGTHS[hi] - LENGTHS[lo];
  const f = span > 0 ? (target - LENGTHS[lo]) / span : 0;
  return (lo + f) / SAMPLES;
}

/** The plane's outline placed with its centre at `at`, pointing along `heading`. */
export function planePolygon(at: Point, heading: number, scale = ICON.planeScale): Point[] {
  // The outline is drawn nose up (-90°), so turn it by heading + 90°.
  const a = heading + Math.PI / 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return PLANE_OUTLINE.map(([x, y]) => {
    const px = x * scale;
    const py = y * scale;
    return { x: at.x + px * cos - py * sin, y: at.y + px * sin + py * cos };
  });
}

/** Where the plane's centre sits when its tail is at route parameter u. */
export function planeCenterAt(u: number): Point {
  const p = routePoint(u);
  const h = routeHeading(u);
  return { x: p.x + PLANE_AHEAD * Math.cos(h), y: p.y + PLANE_AHEAD * Math.sin(h) };
}

/** Bounding box of the finished mark (route, dot ring and plane) in icon units. */
export const MARK_BOX = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 100; i += 1) {
    const p = routePoint(i / 100);
    xs.push(p.x - ICON.stroke / 2, p.x + ICON.stroke / 2);
    ys.push(p.y - ICON.stroke / 2, p.y + ICON.stroke / 2);
  }
  for (const p of planePolygon(planeCenterAt(1), routeHeading(1))) {
    xs.push(p.x);
    ys.push(p.y);
  }
  xs.push(ICON.start.x - ICON.ring, ICON.start.x + ICON.ring);
  ys.push(ICON.start.y - ICON.ring, ICON.start.y + ICON.ring);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
})();

/** Letters a flap shows while it spins: a fixed order so tests and replays look the same. */
const FLAP_CHARS = 'QZKXAEMRSWYJHCPLGVF';

export interface LetterFrame {
  /** What the tile shows now ('' = blank tile). */
  char: string;
  /** 1 = flat; dips toward 0 as a flap falls, drawn as a vertical squash. */
  flip: number;
  /** True once it shows its own letter for good. */
  landed: boolean;
}

/** One letter of the wordmark at time t. */
export function letterAt(index: number, t: number): LetterFrame {
  const start = TIMING.lettersStart + index * TIMING.letterGap;
  if (t < start) return { char: '', flip: 1, landed: false };
  const spun = t - start;
  if (spun >= TIMING.letterSpin) return { char: WORD[index], flip: 1, landed: true };
  const step = Math.floor(spun / TIMING.flapEvery);
  const within = (spun % TIMING.flapEvery) / TIMING.flapEvery;
  // Each flap: the tile squashes to its hinge and opens on the next letter.
  const flip = 0.35 + 0.65 * Math.abs(Math.cos(within * Math.PI));
  const char = FLAP_CHARS[(index * 5 + step * 3) % FLAP_CHARS.length];
  return { char, flip, landed: false };
}

export interface IntroFrame {
  /** Amber dot and ring scale, 0 to about 1.1 while popping, then 1. */
  dot: number;
  /** Share of the route drawn, 0 to 1. */
  drawn: number;
  /** The plane's centre and heading in icon units, and how visible it is. */
  plane: { at: Point; heading: number; opacity: number };
  /** 0 = the dot sits at the screen's centre (matching the native splash), 1 = the whole mark is centred. */
  settle: number;
  /** Wordmark: overall opacity and each letter. */
  wordOpacity: number;
  letters: LetterFrame[];
  /** 0 = panel covers the screen, 1 = panel has lifted away. */
  lift: number;
  /** Whole overlay opacity (Reduce Motion fades instead of lifting). */
  opacity: number;
  done: boolean;
}

/**
 * The intro at time t (ms). With reduceMotion the finished picture shows at once and fades out;
 * nothing moves or flips.
 */
export function introFrame(t: number, reduceMotion = false): IntroFrame {
  if (reduceMotion) {
    const fade = progress(t, TIMING.reducedHold, TIMING.reducedFade);
    return {
      dot: 1,
      drawn: 1,
      plane: { at: planeCenterAt(1), heading: routeHeading(1), opacity: 1 },
      settle: 1,
      wordOpacity: 1,
      letters: [...WORD].map((char) => ({ char, flip: 1, landed: true })),
      lift: 0,
      opacity: 1 - fade,
      done: t >= REDUCED_INTRO_MS,
    };
  }

  const dot = t <= 0 ? 0 : easeOutBack(progress(t, TIMING.dotIn.start, TIMING.dotIn.ms));
  const drawP = progress(t, TIMING.draw.start, TIMING.draw.ms);
  const drawn = easeOutCubic(drawP);
  const u = paramAtLength(drawn);

  // The plane rides the tip while it draws, then takes off along its last heading as the panel lifts.
  const exitP = progress(t, TIMING.exit.start, TIMING.exit.ms);
  const heading = routeHeading(u);
  const base = planeCenterAt(u);
  const flown = easeInCubic(exitP) * FLY_UNITS;
  const at = { x: base.x + flown * Math.cos(heading), y: base.y + flown * Math.sin(heading) };
  const planeOpacity = drawP <= 0 ? 0 : Math.min(1, drawP * 6);

  const letters = [...WORD].map((_, i) => letterAt(i, t));
  const wordOpacity = progress(t, TIMING.lettersStart - 80, 160);

  return {
    dot,
    drawn,
    plane: { at, heading, opacity: planeOpacity },
    settle: easeInOutCubic(drawP),
    wordOpacity,
    letters,
    lift: easeInOutCubic(progress(t, TIMING.exit.start + TIMING.liftDelay, TIMING.exit.ms - TIMING.liftDelay)),
    opacity: 1,
    done: t >= INTRO_MS,
  };
}

/** How far the plane flies on take-off, in icon units. */
export const FLY_UNITS = 1400;

export interface ExitPlan {
  /** Where the plane ends up, in screen points from where it sat. */
  flyX: number;
  flyY: number;
  /** How far the panel rises, in points (negative = up). */
  liftY: number;
  /** Plane flight and panel lift timings, in ms. */
  flyMs: number;
  liftDelay: number;
  liftMs: number;
}

/**
 * The take-off and lift as fixed start and end values (round 169). The screen runs these on the
 * native animation thread, so the lift stays smooth while the app mounts underneath; the curves
 * match introFrame's (ease-in for the plane, ease-in-out for the panel).
 */
export function exitPlan(layout: Pick<IntroLayout, 'scale'>, heading: number, height: number): ExitPlan {
  const fly = FLY_UNITS * layout.scale;
  return {
    flyX: fly * Math.cos(heading),
    flyY: fly * Math.sin(heading),
    liftY: -(height + 40),
    flyMs: TIMING.exit.ms,
    liftDelay: TIMING.liftDelay,
    liftMs: TIMING.exit.ms - TIMING.liftDelay,
  };
}

/** Where a tap jumps to: straight to the take-off, unless it's already under way. */
export function skipTo(t: number): number {
  return Math.max(t, TIMING.exit.start);
}

export interface IntroLayout {
  /** Points per icon unit. */
  scale: number;
  /** Screen position of icon point (0,0) at settle 0 and settle 1. */
  originFrom: Point;
  originTo: Point;
  /** Top of the wordmark row and the tile size. */
  wordTop: number;
  tileW: number;
  tileH: number;
  tileGap: number;
}

/**
 * Sizes the mark to the screen: about half the screen wide (at most 210pt), the wordmark under it,
 * the pair centred a little above the middle. At settle 0 the dot sits at the exact centre, where
 * the native splash draws it, so the hand-off from the splash doesn't jump.
 */
export function introLayout(width: number, height: number): IntroLayout {
  const markW = Math.min(width * 0.5, 210);
  const scale = markW / MARK_BOX.width;
  const markH = MARK_BOX.height * scale;
  const tileGap = Math.max(3, Math.round(width * 0.008));
  const tileW = Math.min(36, Math.floor((Math.min(width, 420) - 64 - tileGap * (WORD.length - 1)) / WORD.length));
  const tileH = Math.round(tileW * 1.4);
  const gap = 28;
  const blockH = markH + gap + tileH;
  const top = (height - blockH) / 2 - height * 0.04;
  const originTo = { x: width / 2 - (MARK_BOX.minX + MARK_BOX.width / 2) * scale, y: top - MARK_BOX.minY * scale };
  const originFrom = { x: width / 2 - ICON.start.x * scale, y: height / 2 - ICON.start.y * scale };
  return { scale, originFrom, originTo, wordTop: top + markH + gap, tileW, tileH, tileGap };
}

/** The ring's diameter in points: the native splash image is drawn this wide so the two match. */
export function splashDotWidth(width: number, height: number): number {
  return introLayout(width, height).scale * ICON.ring * 2;
}
