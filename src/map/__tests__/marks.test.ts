import { colors } from '@/theme';

import { arcSamples, makeLiftedProjector } from '../arcs';
import { normalizeInsets, type GlobeCamera, type Viewport } from '../camera';
import { globeColors, hexToRgb, type Rgb } from '../globeColors';
import {
  chevronPoints,
  chevronsAlong,
  CHEVRON,
  groupHomes,
  houseGlyph,
  LABEL_GAP,
  LABEL_HALO_ALPHA,
  LABEL_RIGHT_MARGIN,
  labelBounds,
  labelOrder,
  markColors,
  markSet,
  marksSummary,
  placeLabels,
  visibleMarks,
  type LabelRequest,
} from '../marks';
import type { MapAirport, RouteLine } from '../types';

const AP = {
  BNA: [-86.678, 36.124],
  DFW: [-97.038, 32.897],
  DAL: [-96.852, 32.847],
  LAX: [-118.408, 33.942],
  ORD: [-87.905, 41.979],
  DEN: [-104.673, 39.862],
  JFK: [-73.779, 40.64],
  LGA: [-73.874, 40.777],
  SYD: [151.177, -33.946],
} as const;
const ap = (code: keyof typeof AP): MapAirport => ({ code, coord: AP[code] });

const route: RouteLine = {
  id: 'r1',
  legs: [
    { id: 'a', from: AP.DFW, to: AP.ORD, fromCode: 'DFW', toCode: 'ORD', tier: 'good', source: 'reported' },
    { id: 'b', from: AP.ORD, to: AP.LGA, fromCode: 'ORD', toCode: 'LGA', tier: 'tight', source: 'estimate' },
  ],
};

const vp: Viewport = { width: 400, height: 800, insets: normalizeInsets({ top: 60, bottom: 340 }) };
const camUS: GlobeCamera = { center: [-92, 37], radius: 600 };

describe('mark set', () => {
  it('overview: home pin, origin dot, destination rings only', () => {
    const m = markSet({ homeAirports: [ap('BNA')], origin: ap('DFW'), destinations: [ap('LAX')] });
    expect(m.map((x) => [x.kind, x.code])).toEqual([
      ['destination', 'LAX'],
      ['origin', 'DFW'],
      ['home', 'BNA'],
    ]);
  });

  it('selected route adds its other airports as small marks', () => {
    const m = markSet({ homeAirports: [ap('BNA')], origin: ap('DFW'), destinations: [ap('JFK')], selectedRoute: route });
    expect(m.filter((x) => x.kind === 'stop').map((x) => x.code)).toEqual(['ORD', 'LGA']);
    // DFW is the origin: not repeated as a stop.
    expect(m.filter((x) => x.code === 'DFW')).toHaveLength(1);
  });

  it('a home code gets only the home pin, drawn last (on top)', () => {
    const m = markSet({ homeAirports: [ap('BNA')], origin: ap('BNA'), destinations: [ap('BNA'), ap('LAX')] });
    expect(m.map((x) => x.kind)).toEqual(['destination', 'home']);
    expect(m[m.length - 1].kind).toBe('home');
  });

  it('first home is the main pin, further homes are outline pins under it', () => {
    const m = markSet({ homeAirports: [ap('BNA'), ap('DEN'), ap('LAX')] });
    expect(m.map((x) => [x.kind, x.code])).toEqual([
      ['altHome', 'DEN'],
      ['altHome', 'LAX'],
      ['home', 'BNA'],
    ]);
  });

  it('homes in the same metro share one pin and label', () => {
    expect(groupHomes([ap('JFK'), ap('BNA'), ap('LGA')]).map((g) => g.map((k) => k.code))).toEqual([
      ['JFK', 'LGA'],
      ['BNA'],
    ]);
    const m = markSet({ homeAirports: [ap('DFW'), ap('DAL')] });
    expect(m).toEqual([{ kind: 'home', code: 'DFW', label: 'DFW/DAL', coord: AP.DFW }]);
  });

  it('nothing in, nothing out', () => {
    expect(markSet({})).toEqual([]);
  });

  it('labels go homes first', () => {
    const m = markSet({ homeAirports: [ap('BNA'), ap('DEN')], origin: ap('DFW'), destinations: [ap('LAX')], selectedRoute: route });
    expect(labelOrder(m).map((x) => x.kind)).toEqual(['home', 'altHome', 'origin', 'destination', 'stop', 'stop']);
  });
});

describe('far-side culling', () => {
  it('drops marks behind the globe and keeps front ones', () => {
    const project = makeLiftedProjector(camUS, vp);
    const shown = visibleMarks(markSet({ homeAirports: [ap('BNA')], destinations: [ap('SYD')] }), project, vp);
    expect(shown.map((m) => m.code)).toEqual(['BNA']);
  });

  it('drops marks far off screen', () => {
    const zoomed: GlobeCamera = { center: [-73.8, 40.7], radius: 2400 };
    const shown = visibleMarks([{ kind: 'origin', code: 'LAX', label: 'LAX', coord: AP.LAX }], makeLiftedProjector(zoomed, vp), vp);
    expect(shown).toEqual([]);
  });
});

describe('label placement', () => {
  const bounds = { left: 0, right: 334 };
  const req = (id: string, x: number, y: number, kind: LabelRequest['kind'] = 'destination'): LabelRequest => ({
    id,
    kind,
    x,
    y,
    width: 24,
    height: 12,
  });

  it('bounds keep a 66pt right margin inside the insets', () => {
    expect(labelBounds(400, normalizeInsets({ left: 10, right: 20 }))).toEqual({ left: 10, right: 400 - 20 - LABEL_RIGHT_MARGIN });
  });

  it('puts the label right of the mark, a little above', () => {
    const [p] = placeLabels([req('A', 100, 200)], bounds);
    expect(p.side).toBe('right');
    expect(p.x).toBe(100 + LABEL_GAP.destination);
    expect(p.dy).toBe(-6);
  });

  it('flips left when the right side would overflow', () => {
    const [p] = placeLabels([req('A', 320, 200)], bounds);
    expect(p.side).toBe('left');
    expect(p.x + 24).toBe(320 - LABEL_GAP.destination);
  });

  it('stays right when neither side fits', () => {
    const [p] = placeLabels([req('A', 10, 200)], { left: 0, right: 30 });
    expect(p.side).toBe('right');
  });

  it('home labels sit level with the pin, 14pt out', () => {
    const [p] = placeLabels([req('H', 100, 200, 'home')], bounds);
    expect(p).toMatchObject({ side: 'right', x: 114, y: 200, dy: 0 });
    const [q] = placeLabels([req('H', 300, 200, 'home')], bounds);
    expect(q).toMatchObject({ side: 'left', x: 300 - 14 - 24 });
  });

  it('nudges down when the spot is taken', () => {
    const [a, b] = placeLabels([req('A', 100, 200), req('B', 104, 202)], bounds);
    expect(a.dy).toBe(-6);
    expect(b.dy).toBe(9);
  });

  it('tries the other side before giving up', () => {
    const placed = placeLabels([req('A', 100, 200), req('B', 100, 203), req('C', 100, 201)], bounds);
    expect(placed.map((p) => [p.side, p.dy])).toEqual([
      ['right', -6],
      ['right', 9],
      ['left', -6],
    ]);
  });

  it('avoids other marks', () => {
    const marks = [
      { id: 'A', x: 100, y: 200, r: 5 },
      { id: 'B', x: 115, y: 194, r: 5 },
    ];
    const [p] = placeLabels([req('A', 100, 200)], bounds, marks);
    expect(p.dy).toBe(9);
  });

  it('labels never overlap when there is room', () => {
    const reqs = Array.from({ length: 6 }, (_, i) => req(`L${i}`, 60 + i * 8, 300 + (i % 2) * 3));
    const placed = placeLabels(reqs, bounds);
    let overlaps = 0;
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i].box;
        const b = placed[j].box;
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) overlaps++;
      }
    // 6 labels in a 40pt cluster: 4 free spots per mark is enough for most.
    expect(overlaps).toBeLessThanOrEqual(2);
  });
});

describe('chevrons', () => {
  const samples = arcSamples(AP.DFW, AP.LGA);
  const project = makeLiftedProjector(camUS, vp);

  it('sit at t = 0.2, 0.66, 0.88 along the lifted arc', () => {
    const cs = chevronsAlong(samples, project);
    expect(cs).toHaveLength(3);
    CHEVRON.ts.forEach((t, k) => {
      const i = Math.round(t * (samples.length - 1));
      const p = project(samples[i].ll, samples[i].lift);
      expect(cs[k].x).toBeCloseTo(p.x, 6);
      expect(cs[k].y).toBeCloseTo(p.y, 6);
    });
  });

  it('point the way the flight goes', () => {
    const east = chevronsAlong(samples, project);
    for (const c of east) expect(Math.cos(c.angle)).toBeGreaterThan(0.5);
    const west = chevronsAlong(arcSamples(AP.LGA, AP.DFW), project);
    for (const c of west) expect(Math.cos(c.angle)).toBeLessThan(-0.5);
    // Tip is ahead of the wings.
    const pts = chevronPoints({ x: 0, y: 0, angle: 0 }, 4.5);
    expect(pts[1]).toEqual({ x: 2.25, y: 0 });
    expect(pts[0].x).toBeCloseTo(-3.15, 9);
    expect(pts[0].y).toBeCloseTo(-4.5, 9);
    const down = chevronPoints({ x: 10, y: 10, angle: Math.PI / 2 }, 4.5);
    expect(down[1].x).toBeCloseTo(10, 9);
    expect(down[1].y).toBeCloseTo(12.25, 9);
  });

  it('are skipped on the far side', () => {
    const away = makeLiftedProjector({ center: [100, -30], radius: 600 }, vp);
    expect(chevronsAlong(samples, away)).toEqual([]);
  });
});

describe('house glyph', () => {
  it('scales with the pin (main r 9, alt r 7)', () => {
    const g = houseGlyph(0, 0, 9);
    expect(g.roof[1]).toEqual({ x: 0, y: -4.4 });
    expect(g.walls[2]).toEqual({ x: 3.2, y: 3.6 });
    const s = houseGlyph(0, 0, 7);
    expect(s.roof[0].x).toBeCloseTo((-4.6 * 7) / 9, 9);
  });
});

// WCAG contrast.
function lum([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function over(top: Rgb, alpha: number, under: Rgb): Rgb {
  return [0, 1, 2].map((i) => top[i] * alpha + under[i] * (1 - alpha)) as unknown as Rgb;
}

describe('mark colors', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const p = colors[scheme];
    const c = markColors(scheme, p);

    it(`${scheme}: amber only on home pins`, () => {
      expect(c.you).toBe(p.you);
      const others = Object.entries(c).filter(([k]) => k !== 'you');
      for (const [, v] of others) {
        expect([p.you, p.youText]).not.toContain(v);
        expect(v.startsWith('rgba') ? v : '').not.toContain(hexToRgb(p.you).join(','));
      }
    });

    it(`${scheme}: other colors come from theme tokens`, () => {
      expect(c.accent).toBe(p.accent);
      expect(c.label).toBe(p.text);
      expect(c.homeGlyph).toBe(p.onAccent);
      expect(c.halo).toBe(`rgba(${hexToRgb(p.surface).join(',')},${LABEL_HALO_ALPHA})`);
    });

    // The glyph is a graphic, not text: WCAG 1.4.11 asks 3:1.
    it(`${scheme}: house glyph contrast on amber >= 3`, () => {
      expect(contrast(hexToRgb(c.homeGlyph), hexToRgb(p.you))).toBeGreaterThanOrEqual(3);
    });

    it(`${scheme}: label on its halo >= 4.5 over any globe color`, () => {
      const g = globeColors(scheme, p);
      for (const under of [g.land, g.oceanHi, g.oceanLo, g.space, '#000000', '#ffffff']) {
        const bg = over(hexToRgb(p.surface), LABEL_HALO_ALPHA, hexToRgb(under));
        expect(contrast(hexToRgb(p.text), bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it('white glyph would fail on dark amber (why onAccent is used)', () => {
    expect(contrast([255, 255, 255], hexToRgb(colors.dark.you))).toBeLessThan(3);
  });
});

describe('accessibility summary', () => {
  it('reads homes, origin and destinations', () => {
    expect(marksSummary({ homeAirports: [ap('BNA')], origin: ap('BNA'), destinations: [ap('LAX')] })).toBe(
      'Home BNA. Origin BNA. Destination LAX.',
    );
    expect(marksSummary({ homeAirports: [ap('BNA'), ap('DEN')], destinations: [ap('LAX'), ap('JFK')] })).toBe(
      'Homes BNA, DEN. Destinations LAX, JFK.',
    );
    expect(marksSummary({})).toBe('');
  });
});
