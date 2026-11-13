/**
 * Round 199 (John: "Route map should indicate in some way this leg is canceled"): a canceled leg of the
 * selected route draws red with an X at its middle, and its time pill becomes a red "Canceled" pill above
 * the X. For a connection only the canceled leg changes.
 */
import { colors } from '@/theme';
import { markCanceledLegs, type RowStatus } from '@/search/statusTags';

import { CANCELED_PILL_DY, legTimeArea, legTimeColors, legTimeSpecs, legTimesSummary, placeLegTimes } from '../legTimes';
import { CANCELED_X, canceledXSegments, legStyle, LINE } from '../routeModel';
import type { RouteLine } from '../types';

const T0 = Date.UTC(2026, 10, 13, 14, 0);
const MIN = 60_000;

const route: RouteLine = {
  id: 'r1',
  legs: [
    {
      id: 'a',
      from: [-97.038, 32.897],
      to: [-87.905, 41.979],
      fromCode: 'DFW',
      toCode: 'ORD',
      tier: 'good',
      source: 'reported',
      departUtc: T0,
      arriveUtc: T0 + 155 * MIN,
    },
    {
      id: 'b',
      from: [-87.905, 41.979],
      to: [-73.874, 40.777],
      fromCode: 'ORD',
      toCode: 'LGA',
      tier: 'wide',
      source: 'reported',
      departUtc: T0 + 220 * MIN,
      arriveUtc: T0 + 340 * MIN,
    },
  ],
};

const tag = (kind: string) => ({ kind, label: kind, spoken: kind });
const status = (...kinds: (string | null)[]) =>
  ({ legs: kinds.map((k) => ({ tag: k ? tag(k) : null })) }) as unknown as RowStatus;

describe('markCanceledLegs', () => {
  it('flags only the leg whose own status is Canceled', () => {
    const marked = markCanceledLegs(route, status(null, 'canceled'));
    expect(marked.legs.map((l) => !!l.canceled)).toEqual([false, true]);
    expect(marked.legs[0]).toBe(route.legs[0]);
  });

  it('leaves the route as it is when nothing is canceled', () => {
    expect(markCanceledLegs(route, status('departed', 'diverted'))).toBe(route);
    expect(markCanceledLegs(route, undefined)).toBe(route);
  });
});

describe('canceled leg line', () => {
  it('is red, solid and unglowing on the selected route, whatever its seats', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = colors[scheme];
      const s = legStyle({ tier: 'wide', source: 'reported', canceled: true }, 'selected', p, scheme);
      expect(s.color).toBe(p.canceled);
      expect(s.dash).toBeNull();
      expect(s.glow).toBeNull();
      expect(s.width).toBe(LINE.selected.width);
      expect(s.halo).not.toBeNull();
    }
  });

  it('keeps the seat color on the other legs', () => {
    const p = colors.light;
    expect(legStyle({ tier: 'wide', source: 'reported' }, 'selected', p, 'light').color).toBe(p.wide);
  });

  it('draws the X as two crossing strokes centered on the middle of the line', () => {
    expect(CANCELED_X.t).toBe(0.5);
    const [a, b] = canceledXSegments(100, 50);
    expect(a).toEqual([100 - CANCELED_X.half, 50 - CANCELED_X.half, 100 + CANCELED_X.half, 50 + CANCELED_X.half]);
    expect(b).toEqual([100 - CANCELED_X.half, 50 + CANCELED_X.half, 100 + CANCELED_X.half, 50 - CANCELED_X.half]);
  });
});

describe('canceled pill', () => {
  const canceled = markCanceledLegs(route, status(null, 'canceled'));

  it('reads Canceled in place of the flight time, only on the canceled leg', () => {
    const specs = legTimeSpecs(canceled);
    expect(specs.map((s) => s.text)).toEqual(['2h 35m', 'Canceled']);
    expect(specs.map((s) => !!s.canceled)).toEqual([false, true]);
    expect(legTimesSummary(canceled)).toBe('DFW to ORD, flight time 2 hours 35 minutes. ORD to LGA, canceled.');
  });

  it('shows even when the leg has no times', () => {
    const noTimes: RouteLine = {
      id: 'x',
      legs: [{ ...route.legs[0], departUtc: undefined, arriveUtc: undefined, canceled: true }],
    };
    expect(legTimeSpecs(noTimes).map((s) => s.text)).toEqual(['Canceled']);
  });

  it('uses the same red pair as the cards', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = colors[scheme];
      const c = legTimeColors(p);
      expect(c.canceledText).toBe(p.canceledFg);
      expect(c.canceledPill).toBe(p.canceledBg);
    }
  });

  it('never sits on the line, where the X is: above first, else below', () => {
    expect(CANCELED_PILL_DY).not.toContain(0);
    const area = legTimeArea(400, 800, { top: 0, right: 0, bottom: 0, left: 0 });
    const req = { id: 'b', anchor: { x: 100, y: 200 }, width: 60, height: 16, dys: CANCELED_PILL_DY };
    const [p] = placeLegTimes([req], [], area);
    expect(p.y).toBe(200 + CANCELED_PILL_DY[0]);
    expect(p.y).toBeLessThan(200);
    // The X's own box stays clear of the pill.
    expect(p.box.y1).toBeLessThan(200 - CANCELED_X.half);
  });
});
