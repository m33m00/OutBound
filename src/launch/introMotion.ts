/**
 * The launch intro's motion, as plain maths so it can be tested without a phone.
 *
 * Story (Jaunt rename, John 2026-11-14: "Roll with that"): the plane flies in drawing its contrail,
 * which lands as the t's crossbar while the letters of "jaunt" rise in one after another, then the
 * plane takes off along its heading and the blue panel lifts away like a gate door, uncovering the
 * app already waiting underneath. (Before the rename it was the OutBound icon
 * with split-flap letters, App Store round 1, 2026-11-06.)
 *
 * Every shape comes from the wordmark itself (src/brand/jauntMark.ts, font units), so the intro and
 * the wordmark in the app are the same drawing.
 */

import { planeCenterAt } from '@/brand/geometry';
import { BOX, LETTERS, TRAIL, type Pt } from '@/brand/jauntMark';

export type Point = Pt;

export const COLORS = {
  /** Boarding blue, the app icon's blue: the intro stays this blue in light and dark mode. */
  panel: '#1C5FD4',
  white: '#FFFFFF',
} as const;

/** j, a, u, n and the t's stem. */
export const LETTER_COUNT = LETTERS.length;

/** When each part runs, in ms from the intro's first frame. */
export const TIMING = {
  /** The plane flies in drawing the contrail behind it, and stops where the t's crossbar ends. */
  draw: { start: 60, ms: 900 },
  /** Each letter rises and fades in over `letterIn`, `letterGap` after the one before. */
  lettersStart: 380,
  letterGap: 70,
  letterIn: 360,
  /** The plane leaves and the panel lifts. */
  exit: { start: 1800, ms: 640 },
  /** The panel starts lifting this long after the plane leaves. */
  liftDelay: 90,
  /** Reduce Motion: the finished picture holds, then fades. */
  reducedHold: 650,
  reducedFade: 300,
} as const;

/** How far below its place a letter starts, in font units. */
export const LETTER_RISE = 90;

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

const progress = (t: number, start: number, ms: number) => clamp01((t - start) / ms);

export interface LetterFrame {
  /** 0 to 1. */
  opacity: number;
  /** How far below its place it still is, in font units. */
  rise: number;
}

/** One letter at time t. */
export function letterAt(index: number, t: number): LetterFrame {
  const p = easeOutCubic(progress(t, TIMING.lettersStart + index * TIMING.letterGap, TIMING.letterIn));
  return { opacity: p, rise: (1 - p) * LETTER_RISE };
}

export interface IntroFrame {
  letters: LetterFrame[];
  /** Share of the contrail drawn, 0 to 1. */
  drawn: number;
  /** The plane's centre and heading in font units, and how visible it is. */
  plane: { at: Point; heading: number; opacity: number };
  /** 0 = panel covers the screen, 1 = panel has lifted away. */
  lift: number;
  /** Whole overlay opacity (Reduce Motion fades instead of lifting). */
  opacity: number;
  done: boolean;
}

/** How far the plane flies on take-off, in font units. */
export const FLY_UNITS = 6000;

/**
 * The intro at time t (ms). With reduceMotion the finished picture shows at once and fades out;
 * nothing moves.
 */
export function introFrame(t: number, reduceMotion = false): IntroFrame {
  const heading = TRAIL.heading;
  if (reduceMotion) {
    const fade = progress(t, TIMING.reducedHold, TIMING.reducedFade);
    return {
      letters: LETTERS.map(() => ({ opacity: 1, rise: 0 })),
      drawn: 1,
      plane: { at: planeCenterAt(1), heading, opacity: 1 },
      lift: 0,
      opacity: 1 - fade,
      done: t >= REDUCED_INTRO_MS,
    };
  }

  const drawP = progress(t, TIMING.draw.start, TIMING.draw.ms);
  const drawn = easeOutCubic(drawP);
  // The plane rides the tip while it draws, then takes off along its heading as the panel lifts.
  const base = planeCenterAt(drawn);
  const flown = easeInCubic(progress(t, TIMING.exit.start, TIMING.exit.ms)) * FLY_UNITS;
  const at = { x: base.x + flown * Math.cos(heading), y: base.y + flown * Math.sin(heading) };

  return {
    letters: LETTERS.map((_, i) => letterAt(i, t)),
    drawn,
    plane: { at, heading, opacity: drawP <= 0 ? 0 : Math.min(1, drawP * 6) },
    lift: easeInOutCubic(progress(t, TIMING.exit.start + TIMING.liftDelay, TIMING.exit.ms - TIMING.liftDelay)),
    opacity: 1,
    done: t >= INTRO_MS,
  };
}

export interface IntroLayout {
  /** Points per font unit. */
  scale: number;
  /** Screen position of font point (0,0), the wordmark's baseline start. */
  origin: Point;
}

/** Sizes the wordmark to the screen: about 60% of the screen wide (at most 260pt), a little above the middle. */
export function introLayout(width: number, height: number): IntroLayout {
  const boxW = BOX.maxX - BOX.minX;
  const boxH = BOX.maxY - BOX.minY;
  const scale = Math.min(width * 0.6, 260) / boxW;
  return {
    scale,
    origin: {
      x: width / 2 - (BOX.minX + boxW / 2) * scale,
      y: height / 2 - height * 0.04 - (BOX.minY + boxH / 2) * scale,
    },
  };
}

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
