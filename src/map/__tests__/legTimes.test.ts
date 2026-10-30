import { colors } from '@/theme';

import { arcSamples, makeLiftedProjector } from '../arcs';
import { normalizeInsets, type GlobeCamera, type Viewport } from '../camera';
import { hexToRgb, rgba } from '../globeColors';
import {
  formatLegDuration,
  LEG_TIME_DY,
  LEG_TIME_PILL,
  LEG_TIME_T,
  legMinutes,
  legTimeAnchor,
  legTimeArea,
  legTimeColors,
  legTimeSpecs,
  legTimesSummary,
  placeLegTimes,
  spokenLegDuration,
  type LegTimeRequest,
} from '../legTimes';
import { CHEVRON, LABEL_RIGHT_MARGIN, type Box } from '../marks';
import type { RouteLine } from '../types';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 21, 14, 0);

const DFW = [-97.038, 32.897] as const;
const ORD = [-87.905, 41.979] as const;
const LGA = [-73.874, 40.777] as const;

const route: RouteLine = {
  id: 'r1',
  legs: [
    {
      id: 'a',
      from: DFW,
      to: ORD,
      fromCode: 'DFW',
      toCode: 'ORD',
      tier: 'good',
      source: 'reported',
      departUtc: T0,
      arriveUtc: T0 + 155 * MIN,
    },
    {
      id: 'b',
      from: ORD,
      to: LGA,
      fromCode: 'ORD',
      toCode: 'LGA',
      tier: 'tight',
      source: 'estimate',
      departUtc: T0 + 200 * MIN,
      arriveUtc: T0 + 245 * MIN,
    },
  ],
};

const vp: Viewport = { width: 400, height: 800, insets: normalizeInsets({ top: 60, bottom: 340 }) };
const camUS: GlobeCamera = { center: [-92, 37], radius: 600 };

describe('duration format (H:MM)', () => {
  it('formats without a leading zero on hours', () => {
    expect(formatLegDuration(45)).toBe('0:45');
    expect(formatLegDuration(155)).toBe('2:35');
    expect(formatLegDuration(605)).toBe('10:05');
    expect(formatLegDuration(60)).toBe('1:00');
  });

  it('rounds the epoch-ms difference to the nearest minute', () => {
    expect(legMinutes(T0, T0 + 155 * MIN + 29_999)).toBe(155);
    expect(legMinutes(T0, T0 + 155 * MIN + 30_000)).toBe(156);
    expect(legMinutes(T0, T0 + 154 * MIN + 31_000)).toBe(155);
  });

  it('has no duration when a time is missing, not finite, or arrival is not after departure', () => {
    expect(legMinutes(undefined, T0)).toBeNull();
    expect(legMinutes(T0, undefined)).toBeNull();
    expect(legMinutes(T0, Number.NaN)).toBeNull();
    expect(legMinutes(T0, T0)).toBeNull();
    expect(legMinutes(T0 + MIN, T0)).toBeNull();
  });

  it('spoken form', () => {
    expect(spokenLegDuration(155)).toBe('2 hours 35 minutes');
    expect(spokenLegDuration(45)).toBe('45 minutes');
    expect(spokenLegDuration(60)).toBe('1 hour');
    expect(spokenLegDuration(61)).toBe('1 hour 1 minute');
  });
});

describe('which labels show', () => {
  it('one per leg of the selected route', () => {
    const s = legTimeSpecs(route);
    expect(s.map((x) => [x.legId, x.text])).toEqual([
      ['a', '2:35'],
      ['b', '0:45'],
    ]);
  });

  it('none without a selection (overview, ghosts, after deselect)', () => {
    expect(legTimeSpecs(null)).toEqual([]);
    expect(legTimeSpecs(undefined)).toEqual([]);
  });

  it('shows every timed leg of the selected route', () => {
    expect(legTimeSpecs(route)).toHaveLength(2);
  });

  it('skips a leg without times, keeps the others', () => {
    const partial: RouteLine = { ...route, legs: [{ ...route.legs[0], arriveUtc: undefined }, route.legs[1]] };
    expect(legTimeSpecs(partial).map((x) => x.legId)).toEqual(['b']);
    expect(legTimeSpecs(partial)[0].legIndex).toBe(1);
  });

  it('accessibility text per leg', () => {
    expect(legTimesSummary(route)).toBe(
      'DFW to ORD, flight time 2 hours 35 minutes. ORD to LGA, flight time 45 minutes.',
    );
    expect(legTimesSummary(null)).toBe('');
  });
});

describe('anchor on the line', () => {
  it('sits at the middle of the arc, away from the chevrons', () => {
    expect(LEG_TIME_T).toBe(0.5);
    for (const t of CHEVRON.ts) expect(Math.abs(t - LEG_TIME_T)).toBeGreaterThan(0.1);
    const samples = arcSamples(DFW, ORD);
    const project = makeLiftedProjector(camUS, vp);
    const mid = samples[Math.round((samples.length - 1) / 2)];
    const p = project(mid.ll, mid.lift);
    expect(legTimeAnchor(samples, project)).toEqual({ x: p.x, y: p.y });
  });

  it('is hidden when the midpoint is on the back of the globe', () => {
    const samples = arcSamples(DFW, ORD);
    const away = makeLiftedProjector({ center: [100, -30], radius: 600 }, vp);
    expect(legTimeAnchor(samples, away)).toBeNull();
    const req: LegTimeRequest = { id: 'a', anchor: legTimeAnchor(samples, away), width: 30, height: 16 };
    expect(placeLegTimes([req], [], legTimeArea(vp.width, vp.height, vp.insets))).toEqual([]);
  });
});

describe('placement', () => {
  const area: Box = { x0: 0, y0: 0, x1: 400, y1: 400 };
  const req = (id: string, x: number, y: number): LegTimeRequest => ({ id, anchor: { x, y }, width: 30, height: 16 });

  it('centers the pill on the line when free', () => {
    const [p] = placeLegTimes([req('a', 100, 100)], [], area);
    expect([p.x, p.y]).toEqual([100, 100]);
  });

  it('IATA labels win: nudges up, then down, then hides', () => {
    const label: Box = { x0: 90, y0: 95, x1: 110, y1: 105 };
    const up = placeLegTimes([req('a', 100, 100)], [label], area);
    expect(up[0].y).toBe(100 + LEG_TIME_DY[1]);

    const above: Box = { x0: 90, y0: 70, x1: 110, y1: 90 };
    const down = placeLegTimes([req('a', 100, 100)], [label, above], area);
    expect(down[0].y).toBe(100 + LEG_TIME_DY[2]);

    const below: Box = { x0: 90, y0: 110, x1: 110, y1: 130 };
    expect(placeLegTimes([req('a', 100, 100)], [label, above, below], area)).toEqual([]);
  });

  it('never covers the legend', () => {
    const legend: Box = { x0: 0, y0: 300, x1: 200, y1: 400 };
    const placed = placeLegTimes([req('a', 100, 380)], [legend], area);
    expect(placed).toEqual([]);
  });

  it('two pills do not overlap each other', () => {
    const placed = placeLegTimes([req('a', 100, 100), req('b', 105, 100)], [], area);
    expect(placed).toHaveLength(2);
    expect(placed[1].y).not.toBe(placed[0].y);
  });

  it('stays inside the visible area (insets and map-button margin)', () => {
    const a = legTimeArea(vp.width, vp.height, vp.insets);
    expect(a).toEqual({ x0: 0, y0: 60, x1: 400 - LABEL_RIGHT_MARGIN, y1: 800 - 340 });
    // Under the bottom panel: hidden.
    expect(placeLegTimes([req('a', 100, 600)], [], a)).toEqual([]);
    // Behind the map buttons on the right: hidden.
    expect(placeLegTimes([req('a', 390, 200)], [], a)).toEqual([]);
  });

  it('pill box matches the 12/16 pill size', () => {
    const [p] = placeLegTimes([req('a', 100, 100)], [], area);
    expect(p.box.y1 - p.box.y0).toBe(16 + 2 * LEG_TIME_PILL.pad);
    expect(LEG_TIME_PILL.fontSize).toBe(12);
    expect(LEG_TIME_PILL.height).toBe(16);
  });
});

describe('colors', () => {
  it('muted text on surface at 0.85, light and dark, no tier colors', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = colors[scheme];
      const c = legTimeColors(p);
      expect(c.text).toBe(p.muted);
      expect(c.pill).toBe(rgba(hexToRgb(p.surface), 0.85));
    }
  });
});
