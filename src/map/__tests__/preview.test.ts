import { geoDistance } from 'd3-geo';

import type { Viewport } from '../camera';
import { makeLiftedProjector } from '../arcs';
import {
  buildPreviewTimeline,
  decidePreview,
  easeSinInOut,
  flyDurationMs,
  planePose,
  PREVIEW,
  previewLostRoute,
  PreviewRun,
  samplePreview,
  type PreviewState,
} from '../preview';
import type { RouteLeg, RouteLine } from '../types';

const H = 3600_000;
const T0 = Date.UTC(2026, 9, 14, 18, 0);
const JFK = [-73.78, 40.64] as const;
const ORD = [-87.9, 41.98] as const;
const DEN = [-104.67, 39.86] as const;

function leg(id: string, from: RouteLeg['from'], to: RouteLeg['to'], fc: string, tc: string, times?: [number, number]): RouteLeg {
  return {
    id,
    from,
    to,
    fromCode: fc,
    toCode: tc,
    tier: 'good',
    source: 'reported',
    ...(times ? { departUtc: times[0], arriveUtc: times[1] } : {}),
  };
}

const timed: RouteLine = {
  id: 'r1',
  legs: [leg('a', JFK, ORD, 'JFK', 'ORD', [T0, T0 + 2 * H]), leg('b', ORD, DEN, 'ORD', 'DEN', [T0 + 3 * H, T0 + 5 * H])],
};
const untimed: RouteLine = {
  id: 'r2',
  legs: [leg('a', JFK, ORD, 'JFK', 'ORD', [T0, T0 + 2 * H]), leg('b', ORD, DEN, 'ORD', 'DEN')],
};

describe('timeline', () => {
  const tl = buildPreviewTimeline(timed)!;

  it('flies each leg for 2600 ms + 3000 ms per radian, with a 900 ms wait between', () => {
    expect(tl.segments.map((s) => s.kind)).toEqual(['fly', 'wait', 'fly']);
    const d1 = 2600 + geoDistance([JFK[0], JFK[1]], [ORD[0], ORD[1]]) * 3000;
    const d2 = 2600 + geoDistance([ORD[0], ORD[1]], [DEN[0], DEN[1]]) * 3000;
    expect(flyDurationMs(timed.legs[0])).toBeCloseTo(d1, 6);
    expect(tl.segments[0].t1 - tl.segments[0].t0).toBeCloseTo(d1, 6);
    expect(tl.segments[1].t1 - tl.segments[1].t0).toBe(900);
    expect(tl.segments[2].t1 - tl.segments[2].t0).toBeCloseTo(d2, 6);
    expect(tl.total).toBeCloseTo(d1 + 900 + d2, 6);
    expect(tl.hasTimes).toBe(true);
  });

  it('waits at the connection airport', () => {
    const w = tl.segments[1];
    expect(w.kind === 'wait' && w.code).toBe('ORD');
  });

  it('skips non-drawable legs and returns null when nothing flies', () => {
    expect(buildPreviewTimeline({ id: 'x', legs: [leg('g', JFK, JFK, 'JFK', 'JFK')] })).toBeNull();
  });

  it('eases sin in/out', () => {
    expect(easeSinInOut(0)).toBe(0);
    expect(easeSinInOut(0.5)).toBeCloseTo(0.5, 12);
    expect(easeSinInOut(1)).toBe(1);
    expect(easeSinInOut(0.25)).toBeCloseTo((1 - Math.cos(Math.PI / 4)) / 2, 12);
  });
});

describe('samplePreview', () => {
  const tl = buildPreviewTimeline(timed)!;
  const [f1, w, f2] = tl.segments;
  const at = (el: number) => samplePreview(tl, PREVIEW.startDelayMs + el);

  it('holds at the departure during the 450 ms start delay', () => {
    const s = samplePreview(tl, 200);
    expect(s.segment).toBe(f1);
    expect(s.eased).toBe(0);
    expect(s.simUtc).toBe(T0);
    expect(s.progress).toBe(0);
  });

  it('interpolates sky time with sin easing during a flight', () => {
    const mid = at((f1.t0 + f1.t1) / 2);
    expect(mid.simUtc).toBeCloseTo(T0 + 1 * H, 0);
    const q = at(f1.t0 + (f1.t1 - f1.t0) / 4);
    expect(q.eased).toBeCloseTo(easeSinInOut(0.25), 9);
    expect(q.simUtc).toBeCloseTo(T0 + 2 * H * easeSinInOut(0.25), 0);
  });

  it('moves the sky linearly from arrival to next departure while waiting', () => {
    const s = at(w.t0 + 450);
    expect(s.segment).toBe(w);
    expect(s.eased).toBeCloseTo(0.5, 9);
    expect(s.simUtc).toBeCloseTo(T0 + 2.5 * H, 0);
  });

  it('ends at the last arrival, holds 2600 ms, then finishes', () => {
    const end = at(tl.total + 1);
    expect(end.segment).toBe(f2);
    expect(end.simUtc).toBe(T0 + 5 * H);
    expect(end.progress).toBe(1);
    expect(end.finished).toBe(false);
    expect(at(tl.total + PREVIEW.holdMs).finished).toBe(false);
    expect(at(tl.total + PREVIEW.holdMs + 1).finished).toBe(true);
  });

  it('reports null sky time for the whole preview if any leg lacks times', () => {
    const tu = buildPreviewTimeline(untimed)!;
    expect(tu.hasTimes).toBe(false);
    for (const el of [0, 1000, tu.total / 2, tu.total]) {
      expect(samplePreview(tu, PREVIEW.startDelayMs + el).simUtc).toBeNull();
    }
  });
});

describe('planePose', () => {
  const vp: Viewport = { width: 400, height: 800, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  const project = makeLiftedProjector({ center: [-90, 40], radius: 600 }, vp);
  const tl = buildPreviewTimeline(timed)!;

  it('sits on the departure at the start, heading roughly west', () => {
    const p = planePose(samplePreview(tl, 0), project)!;
    const jfk = project(JFK, 1);
    expect(p.x).toBeCloseTo(jfk.x, 3);
    expect(p.y).toBeCloseTo(jfk.y, 3);
    expect(Math.cos(p.angle)).toBeLessThan(-0.8);
  });

  it('points up above the connection while waiting', () => {
    const w = tl.segments[1];
    const p = planePose(samplePreview(tl, PREVIEW.startDelayMs + w.t0 + 10), project)!;
    const ord = project(ORD, 1);
    expect(p.x).toBeCloseTo(ord.x, 3);
    expect(p.y).toBeCloseTo(ord.y - PREVIEW.waitLiftPt, 3);
    expect(p.angle).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('is hidden on the far side', () => {
    const far = makeLiftedProjector({ center: [90, -40], radius: 600 }, vp);
    expect(planePose(samplePreview(tl, 0), far)).toBeNull();
  });
});

describe('PreviewRun', () => {
  const tl = buildPreviewTimeline(timed)!;

  it('reports playing at most every 200 ms, then done exactly once', () => {
    const states: PreviewState[] = [];
    const run = new PreviewRun(tl, 1000, (s) => states.push(s));
    for (let t = 1000; t <= 1000 + 1000; t += 16) run.tick(t);
    const playing = states.filter((s) => s.phase === 'playing');
    expect(playing.length).toBeGreaterThanOrEqual(5);
    expect(playing.length).toBeLessThanOrEqual(6);
    expect(playing[0]).toEqual({ routeId: 'r1', phase: 'playing', simUtc: T0, progress: 0 });

    const endAt = 1000 + PREVIEW.startDelayMs + tl.total + PREVIEW.holdMs + 1;
    expect(run.tick(endAt - 2)).not.toBeNull();
    expect(run.tick(endAt)).toBeNull();
    expect(run.tick(endAt + 100)).toBeNull();
    run.cancel();
    const ends = states.filter((s) => s.phase !== 'playing');
    expect(ends).toEqual([{ routeId: 'r1', phase: 'done', simUtc: T0 + 5 * H, progress: 1 }]);
    expect(run.endedAs).toBe('done');
  });

  it('cancel reports once with the last sky time and stops ticking', () => {
    const states: PreviewState[] = [];
    const run = new PreviewRun(tl, 0, (s) => states.push(s));
    run.tick(PREVIEW.startDelayMs + 1000);
    run.cancel();
    run.cancel();
    expect(run.tick(5000)).toBeNull();
    const last = states[states.length - 1];
    expect(last.phase).toBe('cancelled');
    expect(last.simUtc).toBeGreaterThan(T0);
    expect(states.filter((s) => s.phase === 'cancelled')).toHaveLength(1);
  });
});

describe('decidePreview', () => {
  const routes = [timed, untimed];

  it('does nothing without a request', () => {
    expect(decidePreview({ preview: null, reduceMotion: false, selectedId: 'r1', routes })).toEqual({ action: 'none' });
    expect(decidePreview({ preview: undefined, reduceMotion: true, selectedId: 'r1', routes })).toEqual({ action: 'none' });
  });

  it('rejects under Reduce Motion with simUtc null', () => {
    expect(decidePreview({ preview: { routeId: 'r1', nonce: 1 }, reduceMotion: true, selectedId: 'r1', routes })).toEqual({
      action: 'reject',
      state: { routeId: 'r1', phase: 'cancelled', simUtc: null, progress: 0 },
    });
  });

  it('rejects a route that is not selected or unknown', () => {
    expect(decidePreview({ preview: { routeId: 'r1', nonce: 1 }, reduceMotion: false, selectedId: 'r2', routes }).action).toBe('reject');
    expect(decidePreview({ preview: { routeId: 'zz', nonce: 1 }, reduceMotion: false, selectedId: 'zz', routes }).action).toBe('reject');
  });

  it('starts the selected route', () => {
    const d = decidePreview({ preview: { routeId: 'r2', nonce: 3 }, reduceMotion: false, selectedId: 'r2', routes });
    expect(d.action).toBe('start');
  });

  it('detects deselect, route change and a vanished route', () => {
    expect(previewLostRoute('r1', 'r1', routes)).toBe(false);
    expect(previewLostRoute('r1', null, routes)).toBe(true);
    expect(previewLostRoute('r1', 'r2', routes)).toBe(true);
    expect(previewLostRoute('r1', 'r1', [untimed])).toBe(true);
  });
});
