import { colors } from '@/theme';

import { devSampleRoutes } from '../devSampleRoutes';
import { hexToRgb, rgba } from '../globeColors';
import {
  DASH_PATTERN,
  LINE,
  NEUTRAL_LINE,
  TIER_LABEL,
  drawLegs,
  drawnRoutes,
  groupByPath,
  isDashedSource,
  isDrawableLeg,
  legPairKey,
  legStyle,
  legTier,
  legendEntries,
  nextSelection,
  resolveTapSelection,
  routePathKey,
  routeSpokenName,
} from '../routeModel';
import { MAP_ROUTE_LIMIT, type LineSource, type RouteLeg, type RouteLine, type SeatTier } from '../types';

const C: Record<string, readonly [number, number]> = {
  DFW: [-97.04, 32.9],
  ORD: [-87.9, 41.98],
  LGA: [-73.87, 40.78],
  ATL: [-84.43, 33.64],
  EWR: [-74.17, 40.69],
};
let n = 0;
function L(from: string, to: string, tier: SeatTier = 'good', source: LineSource = 'reported'): RouteLeg {
  n += 1;
  return { id: `x${n}`, from: C[from], to: C[to], fromCode: from, toCode: to, tier, source };
}
const route = (id: string, ...legs: RouteLeg[]): RouteLine => ({ id, legs });

const r1 = route('r1', L('DFW', 'LGA'));
const r2 = route('r2', L('DFW', 'ORD'), L('ORD', 'LGA'));
const r3 = route('r3', L('DFW', 'LGA', 'full'));
const r4 = route('r4', L('DFW', 'ORD'), L('ORD', 'LGA', 'tight', 'estimate'));
const r5 = route('r5', L('DFW', 'ATL'), L('ATL', 'LGA'));
const list = [r1, r2, r3, r4, r5];

describe('path grouping', () => {
  it('keys a route by its airport sequence', () => {
    expect(routePathKey(r2)).toBe('DFW>ORD|ORD>LGA');
    expect(routePathKey(r1)).toBe(routePathKey(r3));
    expect(routePathKey(r2)).not.toBe(routePathKey(r5));
  });

  it('a ground transfer between nearby airports changes the path', () => {
    const viaEwr = route('g', L('DFW', 'EWR'));
    expect(routePathKey(viaEwr)).not.toBe(routePathKey(r1));
  });

  it('groups ids by path in list order', () => {
    const g = groupByPath(list);
    expect(g.get('DFW>LGA')).toEqual(['r1', 'r3']);
    expect(g.get('DFW>ORD|ORD>LGA')).toEqual(['r2', 'r4']);
    expect(g.size).toBe(3);
  });

  it('pair keys ignore direction', () => {
    expect(legPairKey(L('DFW', 'ORD'))).toBe(legPairKey(L('ORD', 'DFW')));
  });
});

describe('ghost tap selection', () => {
  it('selects the earliest-arriving route on the tapped path', () => {
    expect(resolveTapSelection(list, 'r3')).toBe('r1');
    expect(resolveTapSelection(list, 'r4')).toBe('r2');
    expect(resolveTapSelection(list, 'r5')).toBe('r5');
    expect(resolveTapSelection(list, 'nope')).toBeNull();
  });

  it('nextSelection: tap a ghost, keep the selected, clear on empty map', () => {
    expect(nextSelection(list, null, 'r3')).toBe('r1');
    expect(nextSelection(list, 'r5', 'r4')).toBe('r2');
    // Tapping the selected route changes nothing.
    expect(nextSelection(list, 'r2', 'r2')).toBeUndefined();
    // Ghost on the selected path resolves to the selected route: no change.
    expect(nextSelection(list, 'r1', 'r3')).toBeUndefined();
    // Empty map: deselect (Q-018) only if something is selected.
    expect(nextSelection(list, 'r2', null)).toBeNull();
    expect(nextSelection(list, null, null)).toBeUndefined();
  });
});

describe('drawn routes', () => {
  const many = Array.from({ length: 14 }, (_, i) => route(`m${i}`, L('DFW', 'LGA')));

  it('draws the top 10 in list order', () => {
    expect(MAP_ROUTE_LIMIT).toBe(10);
    expect(drawnRoutes(many, null).map((r) => r.id)).toEqual(many.slice(0, 10).map((r) => r.id));
  });

  it('adds the selected route if it is below the top 10', () => {
    const d = drawnRoutes(many, 'm12');
    expect(d).toHaveLength(11);
    expect(d[10].id).toBe('m12');
    expect(drawnRoutes(many, 'm3')).toHaveLength(10);
    expect(drawnRoutes(many, 'missing')).toHaveLength(10);
  });

  it('dev sample: 11 routes, 10 drawn', () => {
    expect(drawnRoutes(devSampleRoutes, null)).toHaveLength(10);
  });
});

describe('draw legs', () => {
  it('overview: every unique airport pair once, all gray', () => {
    const legs = drawLegs(list, null);
    expect(legs.every((l) => l.role === 'overview')).toBe(true);
    expect(legs.map((l) => legPairKey(l.leg))).toEqual(['DFW-LGA', 'DFW-ORD', 'LGA-ORD', 'ATL-DFW', 'ATL-LGA']);
  });

  it('selected: its legs last, in order; others are ghosts without its pairs', () => {
    const legs = drawLegs(list, 'r4');
    const sel = legs.filter((l) => l.role === 'selected');
    expect(sel.map((l) => l.leg)).toEqual(r4.legs);
    expect(legs.slice(-2)).toEqual(sel);
    const ghosts = legs.filter((l) => l.role === 'ghost');
    expect(ghosts.map((l) => legPairKey(l.leg))).toEqual(['DFW-LGA', 'ATL-DFW', 'ATL-LGA']);
  });

  it('draws no arc for a zero-length leg', () => {
    const bad = route('z', { ...L('DFW', 'LGA'), toCode: 'DFW', to: C.DFW });
    expect(isDrawableLeg(bad.legs[0])).toBe(false);
    expect(drawLegs([bad], null)).toEqual([]);
  });
});

describe('style mapping', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const p = colors[scheme];

    it(`${scheme}: reported = solid, everything else dashed 8/6`, () => {
      expect(isDashedSource('reported')).toBe(false);
      for (const s of ['estimate', 'typical', 'unknown'] as const) expect(isDashedSource(s)).toBe(true);
      expect(legStyle({ tier: 'good', source: 'reported' }, 'selected', p, scheme).dash).toBeNull();
      expect(legStyle({ tier: 'good', source: 'estimate' }, 'selected', p, scheme).dash).toEqual([8, 6]);
      expect(DASH_PATTERN).toEqual([8, 6]);
    });

    it(`${scheme}: selected legs use their tier token`, () => {
      for (const t of ['wide', 'good', 'okay', 'tight', 'full', 'unknown'] as const) {
        expect(legStyle({ tier: t, source: 'reported' }, 'selected', p, scheme).color).toBe(p[t]);
      }
    });

    it(`${scheme}: typical and unknown sources draw neutral unknown gray`, () => {
      expect(legTier({ tier: 'good', source: 'typical' })).toBe('unknown');
      expect(legStyle({ tier: 'unknown', source: 'typical' }, 'selected', p, scheme).color).toBe(p.unknown);
      expect(legStyle({ tier: 'wide', source: 'unknown' }, 'selected', p, scheme).color).toBe(p.unknown);
      expect(legTier({ tier: 'tight', source: 'estimate' })).toBe('tight');
    });

    it(`${scheme}: overview and ghosts are thin neutral gray, never amber`, () => {
      const ov = legStyle({ tier: 'full', source: 'estimate' }, 'overview', p, scheme);
      const gh = legStyle({ tier: 'full', source: 'reported' }, 'ghost', p, scheme);
      const n = NEUTRAL_LINE[scheme];
      const gray = hexToRgb(p[n.token]);
      expect(ov.color).toBe(rgba(gray, n.overview));
      expect(gh.color).toBe(rgba(gray, n.ghost));
      expect(ov.width).toBeLessThan(LINE.selected.width);
      expect(gh.width).toBeLessThan(LINE.selected.width);
      expect(n.ghost).toBeLessThan(n.overview);
      for (const s of [ov, gh]) {
        expect(s.dash).toBeNull();
        expect(s.halo).toBeNull();
        expect(s.glow).toBeNull();
        expect(s.shadowAlpha).toBeNull();
      }
      const amber = [p.you, p.youText, p.youBg].map((h) => h.toLowerCase());
      for (const t of ['wide', 'good', 'okay', 'tight', 'full', 'unknown'] as const) {
        expect(amber).not.toContain(legStyle({ tier: t, source: 'reported' }, 'selected', p, scheme).color.toLowerCase());
      }
      expect(amber).not.toContain(p[NEUTRAL_LINE[scheme].token].toLowerCase());
    });

    it(`${scheme}: neutral token and alphas (design-critic contrast fix)`, () => {
      expect(NEUTRAL_LINE).toEqual({
        light: { token: 'muted', overview: 0.9, ghost: 0.3 },
        dark: { token: 'text', overview: 0.7, ghost: 0.3 },
      });
    });

    it(`${scheme}: selected has a halo; glow only when reported`, () => {
      const rep = legStyle({ tier: 'good', source: 'reported' }, 'selected', p, scheme);
      const est = legStyle({ tier: 'good', source: 'estimate' }, 'selected', p, scheme);
      expect(rep.halo?.width).toBeCloseTo(LINE.selected.width + LINE.haloExtra, 9);
      expect(rep.glow).not.toBeNull();
      expect(est.glow).toBeNull();
      expect(rep.shadowAlpha).toBeGreaterThan(est.shadowAlpha!);
    });
  }
});

describe('legend and speech', () => {
  it('combines tier color and line style into one row per tier/source pair', () => {
    const r = route('l', L('DFW', 'ORD', 'tight', 'estimate'), L('ORD', 'LGA', 'wide', 'reported'));
    expect(legendEntries(r)).toEqual([
      {
        key: 'wide:reported',
        tier: 'wide',
        source: 'reported',
        dashed: false,
        label: 'Wide open (Reported)',
        accessibilityLabel: 'Wide open, reported, solid line',
      },
      {
        key: 'tight:estimate',
        tier: 'tight',
        source: 'estimate',
        dashed: true,
        label: 'Tight (Estimate)',
        accessibilityLabel: 'Tight, estimate, dashed line',
      },
    ]);
    expect(TIER_LABEL.wide).toBe('Wide open');
  });

  it('lists only combinations present, deduped, reported before estimate', () => {
    const r = route(
      'g',
      L('DFW', 'ORD', 'good', 'estimate'),
      L('ORD', 'ATL', 'good', 'reported'),
      L('ATL', 'LGA', 'good', 'estimate'),
    );
    expect(legendEntries(r).map((e) => e.label)).toEqual(['Good (Reported)', 'Good (Estimate)']);
  });

  it('draws typical and unknown sources in neutral gray, dashed, with no tier word for typical', () => {
    const typ = route('t', L('DFW', 'LGA', 'good', 'typical'));
    expect(legendEntries(typ)).toEqual([
      {
        key: 'unknown:typical',
        tier: 'unknown',
        source: 'typical',
        dashed: true,
        label: 'Typical load',
        accessibilityLabel: 'Typical load, dashed line',
      },
    ]);
    const unk = route('u', L('DFW', 'LGA', 'okay', 'unknown'));
    const [row] = legendEntries(unk);
    expect(row).toMatchObject({ tier: 'unknown', dashed: true, label: 'Unknown (No report)' });
    expect(row.accessibilityLabel).toBe('Unknown, no report, dashed line');
  });

  it('keeps a reported unknown-tier leg solid gray, separate from dashed gray rows', () => {
    const mixed = route('m', L('DFW', 'ORD', 'unknown', 'reported'), L('ORD', 'LGA', 'good', 'typical'));
    const rows = legendEntries(mixed);
    expect(rows.map((e) => [e.label, e.tier, e.dashed])).toEqual([
      ['Unknown (Reported)', 'unknown', false],
      ['Typical load', 'unknown', true],
    ]);
  });

  it('skips undrawable legs and never puts a tier word in a typical row', () => {
    const r = route('s', L('DFW', 'DFW', 'full', 'reported'), L('DFW', 'LGA', 'wide', 'typical'));
    const rows = legendEntries(r);
    expect(rows.map((e) => e.label)).toEqual(['Typical load']);
    for (const t of Object.values(TIER_LABEL)) expect(rows[0].label).not.toContain(t);
  });

  it('speaks a route as its airports', () => {
    expect(routeSpokenName(r2)).toBe('DFW to ORD to LGA');
    const transfer = route('t', L('DFW', 'EWR'), L('LGA', 'ORD'));
    expect(routeSpokenName(transfer)).toBe('DFW to EWR to LGA to ORD');
  });
});
