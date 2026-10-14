import { colors } from '@/theme';

import { makeLiftedProjector } from '../arcs';
import { normalizeInsets, type GlobeCamera, type Viewport } from '../camera';
import { globeColors, hexToRgb, type Rgb } from '../globeColors';
import { LABEL_DY, LABEL_GAP, markExtent, markSet, placeLabels, visibleMarks, type LabelRequest } from '../marks';
import {
  STATUS_BADGE,
  STATUS_MAX_EXTENT,
  statusColors,
  statusExtent,
  statusOffset,
  statusSet,
  statusShapePoints,
  statusSummary,
  visibleStatus,
} from '../status';
import type { AirportStatusMark, MapAirport, RouteLine } from '../types';

const AP = {
  BNA: [-86.678, 36.124],
  DFW: [-97.038, 32.897],
  LAX: [-118.408, 33.942],
  ORD: [-87.905, 41.979],
  DEN: [-104.673, 39.862],
  JFK: [-73.779, 40.64],
  LGA: [-73.874, 40.777],
  EWR: [-74.169, 40.692],
  SYD: [151.177, -33.946],
} as const;
type Code = keyof typeof AP;
const ap = (code: Code): MapAirport => ({ code, coord: AP[code] });
const st = (code: Code, level: AirportStatusMark['level']): AirportStatusMark => ({ code, coord: AP[code], level });

const route: RouteLine = {
  id: 'r1',
  legs: [
    { id: 'a', from: AP.DFW, to: AP.ORD, fromCode: 'DFW', toCode: 'ORD', tier: 'good', source: 'reported' },
    { id: 'b', from: AP.ORD, to: AP.LGA, fromCode: 'ORD', toCode: 'LGA', tier: 'tight', source: 'estimate' },
  ],
};

const vp: Viewport = { width: 400, height: 800, insets: normalizeInsets({ top: 60, bottom: 340 }) };
const camUS: GlobeCamera = { center: [-92, 37], radius: 600 };

describe('badge shape per level', () => {
  it('Caution is a diamond, Likely delays a triangle', () => {
    expect(STATUS_BADGE.caution.shape).toBe('diamond');
    expect(STATUS_BADGE.likelyDelays.shape).toBe('triangle');
    const d = statusShapePoints('caution', 10, 20);
    expect(d).toEqual([
      { x: 10, y: 15 },
      { x: 15, y: 20 },
      { x: 10, y: 25 },
      { x: 5, y: 20 },
    ]);
    const t = statusShapePoints('likelyDelays', 0, 0);
    expect(t).toHaveLength(3);
    expect(t[0]).toEqual({ x: 0, y: -6 }); // apex up
    // Equilateral, centroid at the center.
    const side = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(side(t[0], t[1])).toBeCloseTo(side(t[1], t[2]), 9);
    expect(side(t[1], t[2])).toBeCloseTo(side(t[2], t[0]), 9);
    expect((t[0].y + t[1].y + t[2].y) / 3).toBeCloseTo(0, 9);
  });

  it('about the destination ring footprint (extent within 2 pt of it)', () => {
    const ring = markExtent('destination');
    for (const l of ['caution', 'likelyDelays'] as const) {
      expect(Math.abs(statusExtent(l) - ring)).toBeLessThanOrEqual(2);
    }
  });
});

describe('status set', () => {
  const marks = markSet({ homeAirports: [ap('BNA')], origin: ap('DFW'), destinations: [ap('LAX')] });

  it('anchors to the airport mark, or none', () => {
    const s = statusSet([st('BNA', 'caution'), st('LAX', 'likelyDelays'), st('ORD', 'caution')], marks);
    const by = Object.fromEntries(s.map((b) => [b.codes.join('/'), b]));
    expect(by.BNA.anchor).toBe('home');
    expect(by.LAX.anchor).toBe('destination');
    expect(by.ORD.anchor).toBeNull();
    expect(by.ORD.coord).toEqual(AP.ORD);
  });

  it('home group pin carries the worst status of its codes', () => {
    const m = markSet({ homeAirports: [ap('JFK'), ap('LGA')] });
    const s = statusSet([st('JFK', 'caution'), st('LGA', 'likelyDelays')], m);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ codes: ['JFK', 'LGA'], level: 'likelyDelays', anchor: 'home', coord: AP.JFK });
  });

  it('a repeated code keeps the worst level', () => {
    const s = statusSet([st('ORD', 'likelyDelays'), st('ORD', 'caution')], []);
    expect(s).toHaveLength(1);
    expect(s[0].level).toBe('likelyDelays');
  });

  it('draws Likely delays above Caution', () => {
    const s = statusSet([st('LAX', 'likelyDelays'), st('ORD', 'caution')], marks);
    expect(s.map((b) => b.level)).toEqual(['caution', 'likelyDelays']);
  });

  it('nothing in, nothing out', () => {
    expect(statusSet(undefined, marks)).toEqual([]);
    expect(statusSet([], marks)).toEqual([]);
  });
});

describe('dimming when a route is selected', () => {
  const input = [st('ORD', 'caution'), st('DEN', 'likelyDelays'), st('LGA', 'caution')];

  it('no selection: all full strength', () => {
    expect(statusSet(input, []).every((b) => !b.dim)).toBe(true);
  });

  it("selected route's stations stay full, others dim (drawn first)", () => {
    const marks = markSet({ origin: ap('DFW'), destinations: [ap('LGA')], selectedRoute: route });
    const s = statusSet(input, marks, route);
    const by = Object.fromEntries(s.map((b) => [b.codes[0], b]));
    expect(by.ORD.dim).toBe(false);
    expect(by.ORD.anchor).toBe('stop');
    expect(by.LGA.dim).toBe(false);
    expect(by.DEN.dim).toBe(true);
    expect(s[0].codes).toEqual(['DEN']);
    expect(STATUS_BADGE.dimAlpha).toBeCloseTo(0.35, 9);
  });
});

describe('placement', () => {
  const project = makeLiftedProjector(camUS, vp);

  it('sits up-left of the mark and never covers it', () => {
    for (const kind of ['home', 'altHome', 'origin', 'destination', 'stop'] as const) {
      const o = statusOffset(kind);
      expect(o.dx).toBeLessThan(0);
      expect(o.dy).toBeLessThan(0);
      expect(o.dx).toBeCloseTo(o.dy, 9);
      // Badge circle clears the mark's outer edge.
      expect(Math.hypot(o.dx, o.dy)).toBeGreaterThanOrEqual(markExtent(kind) + STATUS_MAX_EXTENT - 1e-9);
    }
    expect(statusOffset(null)).toEqual({ dx: 0, dy: 0 });
  });

  it('on screen: offset from the home pin, clear of it', () => {
    const marks = markSet({ homeAirports: [ap('BNA')] });
    const [pin] = visibleMarks(marks, project, vp);
    const [b] = visibleStatus(statusSet([st('BNA', 'likelyDelays')], marks), project, vp);
    expect(b.x).toBeLessThan(pin.x);
    expect(b.y).toBeLessThan(pin.y);
    expect(Math.hypot(b.x - pin.x, b.y - pin.y)).toBeGreaterThanOrEqual(markExtent('home') + statusExtent('likelyDelays'));
    expect(b.id).toBe('status:BNA');
  });

  it('labels avoid the badge (left label moves off it)', () => {
    // A destination ring with its label forced left (right edge close).
    const x = 200;
    const y = 300;
    const o = statusOffset('destination');
    const req: LabelRequest = { id: 'LAX', kind: 'destination', x, y, width: 26, height: 12.5 };
    const bounds = { left: 0, right: x + 5 };
    const ring = { id: 'LAX', x, y, r: markExtent('destination') };
    const without = placeLabels([req], bounds, [ring]);
    expect(without[0].side).toBe('left');
    expect(without[0].dy).toBe(LABEL_DY.destination[0]);
    const badge = { id: 'status:LAX', x: x + o.dx, y: y + o.dy, r: STATUS_MAX_EXTENT };
    const withBadge = placeLabels([req], bounds, [ring, badge]);
    expect(withBadge[0].side).toBe('left');
    expect(withBadge[0].dy).toBe(LABEL_DY.destination[1]);
    const box = withBadge[0].box;
    const bb = { x0: badge.x - badge.r, y0: badge.y - badge.r, x1: badge.x + badge.r, y1: badge.y + badge.r };
    expect(box.x0 < bb.x1 && bb.x0 < box.x1 && box.y0 < bb.y1 && bb.y0 < box.y1).toBe(false);
    expect(withBadge[0].x + 26).toBeLessThanOrEqual(x - LABEL_GAP.destination + 1e-9);
  });

  it('a right-side home label does not collide with the badge', () => {
    const o = statusOffset('home');
    const req: LabelRequest = { id: 'BNA', kind: 'home', x: 100, y: 300, width: 28, height: 12.5 };
    const badge = { id: 'status:BNA', x: 100 + o.dx, y: 300 + o.dy, r: STATUS_MAX_EXTENT };
    const [p] = placeLabels([req], { left: 0, right: 400 }, [{ id: 'BNA', x: 100, y: 300, r: markExtent('home') }, badge]);
    expect(p.side).toBe('right');
    expect(p.dy).toBe(0);
  });
});

describe('far-side culling', () => {
  it('drops badges whose airport is behind the globe', () => {
    const specs = statusSet([st('ORD', 'caution'), st('SYD', 'likelyDelays')], []);
    const us = visibleStatus(specs, makeLiftedProjector(camUS, vp), vp);
    expect(us.map((b) => b.codes[0])).toEqual(['ORD']);
    const away = visibleStatus(specs, makeLiftedProjector({ center: [151, -34], radius: 600 }, vp), vp);
    expect(away.map((b) => b.codes[0])).toEqual(['SYD']);
  });
});

describe('accessibility summary', () => {
  it('reads Likely delays first, then Caution', () => {
    expect(statusSummary([st('DFW', 'caution'), st('ORD', 'likelyDelays')])).toBe(
      'Likely delays at ORD. Caution at DFW.',
    );
    expect(statusSummary([st('ORD', 'likelyDelays'), st('EWR', 'likelyDelays'), st('ORD', 'caution')])).toBe(
      'Likely delays at ORD, EWR.',
    );
    expect(statusSummary([])).toBe('');
    expect(statusSummary(undefined)).toBe('');
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

describe('status colors', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const p = colors[scheme];
    const c = statusColors(p);

    it(`${scheme}: weather tokens only, never amber or tier colors`, () => {
      expect(c.caution).toBe(p.caution);
      expect(c.likelyDelays).toBe(p.likelyDelays);
      expect(c.halo).toBe(p.surface);
      const banned = [p.you, p.youText, p.youBg, p.wide, p.good, p.okay, p.tight, p.full, p.unknown];
      for (const v of Object.values(c)) expect(banned).not.toContain(v);
      expect(c.caution).not.toBe(c.likelyDelays);
    });

    // Graphic, WCAG 1.4.11: 3:1 against the adjacent color (the opaque halo).
    it(`${scheme}: badge on its halo >= 3`, () => {
      for (const fill of [c.caution, c.likelyDelays]) {
        expect(contrast(hexToRgb(fill), hexToRgb(c.halo))).toBeGreaterThanOrEqual(3);
      }
    });

    // The halo is what separates the badge from the globe, so it is opaque.
    it(`${scheme}: halo is opaque over land, ocean and space`, () => {
      const g = globeColors(scheme, p);
      expect(c.halo).toMatch(/^#[0-9a-f]{6}$/i);
      expect([g.land, g.oceanHi, g.oceanLo]).not.toContain(c.halo);
    });
  }
});
