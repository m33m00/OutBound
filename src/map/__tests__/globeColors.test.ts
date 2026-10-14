import { colors } from '@/theme';

import {
  globeColors,
  hexToRgb,
  rgba,
  STATE_LINE_ALPHA,
  STATE_LINE_ALPHA_HI,
} from '../globeColors';

describe('globeColors', () => {
  it('maps space and state lines from theme tokens', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const g = globeColors(scheme, colors[scheme]);
      expect(g.space).toBe(colors[scheme].bg);
      expect(g.stateLine).toBe(rgba(hexToRgb(colors[scheme].text), STATE_LINE_ALPHA));
      expect(g.stateLineHi).toBe(rgba(hexToRgb(colors[scheme].text), STATE_LINE_ALPHA_HI));
    }
  });

  it('uses the v9.1 prototype globe values', () => {
    expect(globeColors('light', colors.light)).toMatchObject({
      oceanHi: '#d5e3ee',
      oceanLo: '#aac0d3',
      land: '#f4f5ef',
      landEdge: '#c4cdc3',
    });
    expect(globeColors('dark', colors.dark)).toMatchObject({
      oceanHi: '#1d4266',
      oceanLo: '#0b1a2c',
      land: '#4a767c',
      landEdge: '#2a4a50',
    });
  });

  it('follows a changed palette', () => {
    const custom = { ...colors.light, bg: '#000000', text: '#ffffff' };
    const g = globeColors('light', custom);
    expect(g.space).toBe('#000000');
    expect(g.stateLine).toBe('rgba(255,255,255,0.4)');
    expect(g.stateLineHi).toBe('rgba(255,255,255,0.5)');
  });

  it('does not duplicate a theme token as a hardcoded globe color', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tokens = new Set(Object.values(colors[scheme]).map((v) => v.toLowerCase()));
      const g = globeColors(scheme, colors[scheme]);
      for (const v of [g.oceanHi, g.oceanLo, g.land, g.landEdge]) {
        expect(tokens.has(v.toLowerCase())).toBe(false);
      }
    }
  });
});

describe('color helpers', () => {
  it('parses hex', () => {
    expect(hexToRgb('#1d3d84')).toEqual([29, 61, 132]);
    expect(() => hexToRgb('red')).toThrow();
  });

  it('formats rgba and clamps alpha', () => {
    expect(rgba([1, 2, 3], 0.5)).toBe('rgba(1,2,3,0.5)');
    expect(rgba([1, 2, 3], 2)).toBe('rgba(1,2,3,1)');
  });
});
