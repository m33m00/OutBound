/**
 * Globe colors. These are not theme tokens (DECISIONS.md has none for the
 * globe), so they live here, mapped from the active theme:
 * - Taken from the theme: space = `bg`, state lines = `text` at 40%.
 * - Taken from reference/globe-prototype-v9.1.html (Ice Mix uses the base
 *   :root / dark values): ocean gradient, land, land edge, atmosphere, limb,
 *   route ground shadow (--route-shadow).
 * Pure: pass the scheme and palette from `useColorSchemeName()` / `useColors()`.
 */
import type { ColorScheme, Palette } from '@/theme';

export type Rgb = readonly [number, number, number];

export interface GlobeColors {
  /** Behind the globe. */
  space: string;
  /** Ocean gradient: light spot top-left to edge. */
  oceanHi: string;
  oceanLo: string;
  land: string;
  /** Coastline and country borders. */
  landEdge: string;
  /** US state lines (color with alpha). */
  stateLine: string;
  /** US state lines when zoomed in to 50m detail (a bit stronger). */
  stateLineHi: string;
  /** Atmosphere glow and rim, as an RGB triplet used at several alphas. */
  atmosphere: Rgb;
  /** Darkening toward the globe edge (color with alpha). */
  limb: string;
  /** Ground shadow under the selected route arc: RGB and base alpha. */
  routeShadow: Rgb;
  routeShadowAlpha: number;
}

/** Prototype-only values, per scheme. */
const globeOnly = {
  light: {
    oceanHi: '#d5e3ee',
    oceanLo: '#aac0d3',
    land: '#f4f5ef',
    landEdge: '#c4cdc3',
    atmosphere: [120, 170, 230] as Rgb,
    limb: 'rgba(40,60,90,0.18)',
    routeShadow: [20, 40, 70] as Rgb,
    routeShadowAlpha: 0.18,
  },
  dark: {
    oceanHi: '#1d4266',
    oceanLo: '#0b1a2c',
    land: '#4a767c',
    landEdge: '#2a4a50',
    atmosphere: [90, 160, 255] as Rgb,
    limb: 'rgba(0,0,0,0.45)',
    routeShadow: [0, 0, 0] as Rgb,
    routeShadowAlpha: 0.45,
  },
} as const;

/**
 * Prototype draws state lines in its label ink at 40% (50% when zoomed in to
 * 50m detail); ours is the `text` token.
 */
export const STATE_LINE_ALPHA = 0.4;
export const STATE_LINE_ALPHA_HI = 0.5;

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Expected #rrggbb, got "${hex}"`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(rgb: Rgb, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

export function globeColors(scheme: ColorScheme, palette: Palette): GlobeColors {
  const g = globeOnly[scheme];
  return {
    space: palette.bg,
    oceanHi: g.oceanHi,
    oceanLo: g.oceanLo,
    land: g.land,
    landEdge: g.landEdge,
    stateLine: rgba(hexToRgb(palette.text), STATE_LINE_ALPHA),
    stateLineHi: rgba(hexToRgb(palette.text), STATE_LINE_ALPHA_HI),
    atmosphere: g.atmosphere,
    limb: g.limb,
    routeShadow: g.routeShadow,
    routeShadowAlpha: g.routeShadowAlpha,
  };
}
