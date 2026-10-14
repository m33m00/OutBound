/**
 * Flight preview timeline (backlog item 11, Q-034/Q-035). Pure: no Skia,
 * no React, no timers. Time is passed in, so tests drive it directly.
 *
 * Follows startSim / simNow / drawSimPlane in reference/globe-prototype-v9.1.html:
 * - one 'fly' segment per leg, 2600 ms + 3000 ms per radian of distance,
 *   eased sin in/out;
 * - a 900 ms 'wait' at each connection, linear;
 * - starts 450 ms after the request, then holds 2600 ms at the end.
 * The whole trip plays in one go.
 *
 * Sky time (simUtc): each leg's departUtc -> arriveUtc, and arrival -> next
 * departure while waiting. If any leg lacks times, simUtc is null for the
 * whole preview and the sky stays at real time.
 */
import { geoDistance } from 'd3-geo';

import { legSamples, type LiftedProjector } from './arcs';
import { isDrawableLeg } from './routeModel';
import type { LonLat, MapPreviewPhase, MapPreviewRequest, MapPreviewState, RouteLeg, RouteLine } from './types';

export const PREVIEW = {
  startDelayMs: 450,
  holdMs: 2600,
  waitMs: 900,
  flyBaseMs: 2600,
  flyPerRadMs: 3000,
  /** onPreviewState is called at most this often while playing (~5 Hz). */
  reportMs: 200,
  /** Plane: halo radius, halo alpha (accent), glyph scale (24 pt box). */
  haloRadius: 15,
  haloAlpha: 0.18,
  planeScale: 1.05,
  /** Plane sits this far above a connection airport while waiting. */
  waitLiftPt: 6,
  /**
   * Plane glyph look (prototype drawPlaneAt). These are scenery, like the
   * globe's ocean and land colors, not theme UI tokens: a white plane with a
   * soft dark shadow reads on both themes. Only the outline and halo use the
   * theme accent.
   */
  planeFill: '#ffffff',
  planeShadow: 'rgba(0,0,0,0.45)',
  planeShadowBlur: 3,
  planeStrokeWidth: 1.3,
} as const;

export type PreviewPhase = MapPreviewPhase;
export type PreviewState = MapPreviewState;

export type PreviewSegment =
  | { kind: 'fly'; leg: RouteLeg; t0: number; t1: number; m0: number | null; m1: number | null }
  | { kind: 'wait'; at: LonLat; code: string; t0: number; t1: number; m0: number | null; m1: number | null };

export interface PreviewTimeline {
  routeId: string;
  segments: PreviewSegment[];
  /** Sum of segment durations (ms), without start delay or hold. */
  total: number;
  /** True when every leg has departUtc and arriveUtc. */
  hasTimes: boolean;
}

export function easeSinInOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return (1 - Math.cos(Math.PI * x)) / 2;
}

export function flyDurationMs(leg: Pick<RouteLeg, 'from' | 'to'>): number {
  const d = geoDistance([leg.from[0], leg.from[1]], [leg.to[0], leg.to[1]]);
  return PREVIEW.flyBaseMs + d * PREVIEW.flyPerRadMs;
}

const finite = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Timeline for a route, or null when it has no drawable leg. */
export function buildPreviewTimeline(route: RouteLine): PreviewTimeline | null {
  const legs = route.legs.filter(isDrawableLeg);
  if (legs.length === 0) return null;
  const hasTimes = legs.every((l) => finite(l.departUtc) && finite(l.arriveUtc));
  const segments: PreviewSegment[] = [];
  let t = 0;
  legs.forEach((leg, i) => {
    if (i > 0) {
      const prev = legs[i - 1];
      segments.push({
        kind: 'wait',
        at: prev.to,
        code: prev.toCode,
        t0: t,
        t1: t + PREVIEW.waitMs,
        m0: hasTimes ? prev.arriveUtc! : null,
        m1: hasTimes ? leg.departUtc! : null,
      });
      t += PREVIEW.waitMs;
    }
    const ms = flyDurationMs(leg);
    segments.push({
      kind: 'fly',
      leg,
      t0: t,
      t1: t + ms,
      m0: hasTimes ? leg.departUtc! : null,
      m1: hasTimes ? leg.arriveUtc! : null,
    });
    t += ms;
  });
  return { routeId: route.id, segments, total: t, hasTimes };
}

export interface PreviewSample {
  segment: PreviewSegment;
  /** Eased progress within the segment (sin in/out for fly, linear for wait). */
  eased: number;
  simUtc: number | null;
  /** Elapsed share of the whole trip (0..1), excluding delay and hold. */
  progress: number;
  /** True once the start delay, all segments and the hold have passed. */
  finished: boolean;
}

/** Where the preview is `elapsedMs` after it was requested. */
export function samplePreview(tl: PreviewTimeline, elapsedMs: number): PreviewSample {
  const el = Math.max(0, elapsedMs - PREVIEW.startDelayMs);
  let segment = tl.segments[tl.segments.length - 1];
  let p = 1;
  for (const s of tl.segments) {
    if (el <= s.t1) {
      segment = s;
      p = Math.max(0, Math.min(1, (el - s.t0) / (s.t1 - s.t0)));
      break;
    }
  }
  const eased = segment.kind === 'fly' ? easeSinInOut(p) : p;
  const simUtc =
    segment.m0 != null && segment.m1 != null ? segment.m0 + (segment.m1 - segment.m0) * eased : null;
  return {
    segment,
    eased,
    simUtc,
    progress: tl.total > 0 ? Math.min(1, el / tl.total) : 1,
    finished: el > tl.total + PREVIEW.holdMs,
  };
}

export interface PlanePose {
  x: number;
  y: number;
  /** Heading in radians along the screen tangent (0 = +x). */
  angle: number;
}

/** Plane position on the lifted arc (or above the connection), or null if hidden. */
export function planePose(sample: PreviewSample, project: LiftedProjector): PlanePose | null {
  const seg = sample.segment;
  if (seg.kind === 'wait') {
    const q = project(seg.at, 1);
    if (!q.visible) return null;
    return { x: q.x, y: q.y - PREVIEW.waitLiftPt, angle: -Math.PI / 2 };
  }
  const sp = legSamples(seg.leg);
  const fi = sample.eased * (sp.length - 1);
  const i = Math.min(sp.length - 2, Math.floor(fi));
  const fr = fi - i;
  const q1 = project(sp[i].ll, sp[i].lift);
  const q2 = project(sp[i + 1].ll, sp[i + 1].lift);
  if (!q1.visible) return null;
  return {
    x: q1.x + (q2.x - q1.x) * fr,
    y: q1.y + (q2.y - q1.y) * fr,
    angle: Math.atan2(q2.y - q1.y, q2.x - q1.x),
  };
}

/**
 * One running preview. Call `tick(now)` each frame with a monotonic clock
 * (ms); it reports through `report` at most every PREVIEW.reportMs while
 * playing, then exactly once 'done' or 'cancelled'.
 */
export class PreviewRun {
  readonly timeline: PreviewTimeline;
  private readonly startMs: number;
  private readonly report: (s: PreviewState) => void;
  private lastReport = -Infinity;
  private last: PreviewSample | null = null;
  private ended: PreviewPhase | null = null;

  constructor(timeline: PreviewTimeline, startMs: number, report: (s: PreviewState) => void) {
    this.timeline = timeline;
    this.startMs = startMs;
    this.report = report;
  }

  get routeId(): string {
    return this.timeline.routeId;
  }

  /** null while playing, else how it ended. */
  get endedAs(): PreviewPhase | null {
    return this.ended;
  }

  get sample(): PreviewSample | null {
    return this.last;
  }

  tick(nowMs: number): PreviewSample | null {
    if (this.ended) return null;
    const s = samplePreview(this.timeline, nowMs - this.startMs);
    this.last = s;
    if (s.finished) {
      this.ended = 'done';
      this.report({ routeId: this.routeId, phase: 'done', simUtc: s.simUtc, progress: 1 });
      return null;
    }
    if (nowMs - this.lastReport >= PREVIEW.reportMs) {
      this.lastReport = nowMs;
      this.report({ routeId: this.routeId, phase: 'playing', simUtc: s.simUtc, progress: s.progress });
    }
    return s;
  }

  /** Stop now; reports 'cancelled' once. No-op after the run ended. */
  cancel(): void {
    if (this.ended) return;
    this.ended = 'cancelled';
    this.report({
      routeId: this.routeId,
      phase: 'cancelled',
      simUtc: this.last?.simUtc ?? null,
      progress: this.last?.progress ?? 0,
    });
  }
}

export type PreviewDecision =
  | { action: 'none' }
  | { action: 'reject'; state: PreviewState }
  | { action: 'start'; timeline: PreviewTimeline };

/**
 * What to do with a new preview request (a new routeId + nonce):
 * - none: no request.
 * - reject (report 'cancelled', simUtc null): Reduce Motion is on, or the
 *   route is not the selected one, or it has nothing to fly.
 * - start otherwise.
 */
export function decidePreview(input: {
  preview: MapPreviewRequest | null | undefined;
  reduceMotion: boolean;
  selectedId: string | null;
  routes: readonly RouteLine[];
}): PreviewDecision {
  const { preview, reduceMotion, selectedId, routes } = input;
  if (!preview) return { action: 'none' };
  const reject: PreviewDecision = {
    action: 'reject',
    state: { routeId: preview.routeId, phase: 'cancelled', simUtc: null, progress: 0 },
  };
  if (reduceMotion || preview.routeId !== selectedId) return reject;
  const route = routes.find((r) => r.id === preview.routeId);
  const timeline = route ? buildPreviewTimeline(route) : null;
  return timeline ? { action: 'start', timeline } : reject;
}

/** True when a running preview must stop because the selection moved away. */
export function previewLostRoute(
  routeId: string,
  selectedId: string | null,
  routes: readonly RouteLine[],
): boolean {
  return selectedId !== routeId || !routes.some((r) => r.id === routeId);
}
