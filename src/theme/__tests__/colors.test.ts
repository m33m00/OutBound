import { colors, type ColorToken } from '../colors';

// WCAG relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Text-on-background pairs the app uses. Bare tier colors (wide, good, ...)
// are excluded: DECISIONS.md allows them only as large numbers or fills.
const textPairs: [ColorToken, ColorToken][] = [
  ...(['text', 'muted', 'faint'] as const).flatMap((fg) =>
    (['bg', 'surface', 'surface2'] as const).map((bg): [ColorToken, ColorToken] => [fg, bg]),
  ),
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['accent', 'accentSoft'],
  ['onAccent', 'accent'],
  ['youText', 'bg'],
  ['youText', 'surface'],
  ['youText', 'youBg'],
  ['wideFg', 'wideBg'],
  ['goodFg', 'goodBg'],
  ['okayFg', 'okayBg'],
  ['tightFg', 'tightBg'],
  ['fullFg', 'fullBg'],
  ['unknownFg', 'unknownBg'],
  ['caution', 'cautionBg'],
  ['likelyDelays', 'likelyDelaysBg'],
  // Row status tags (Q-050): canceled red is provisional, pending John.
  ['canceledFg', 'canceledBg'],
];

describe('Ice Mix colors', () => {
  it('keeps the confirmed DECISIONS.md values', () => {
    expect(colors.light.accent).toBe('#1d3d84');
    expect(colors.dark.accent).toBe('#9bb8ef');
    expect(colors.light.youText).toBe('#9a5200');
    expect(colors.dark.youText).toBe('#ffc27a');
  });

  it('defines the same tokens in light and dark', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it.each(['light', 'dark'] as const)('%s: provisional canceled red is not the Full-tier red', (scheme) => {
    const p = colors[scheme];
    expect([p.canceled, p.canceledBg, p.canceledFg]).not.toContain(p.full);
    expect(p.canceled).not.toBe(p.full);
    expect(p.canceledFg).not.toBe(p.fullFg);
    expect(p.canceledBg).not.toBe(p.fullBg);
  });

  describe.each(['light', 'dark'] as const)('%s', (scheme) => {
    it.each(textPairs)('%s on %s meets 4.5:1', (fg, bg) => {
      const p = colors[scheme];
      expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
    });
  });
});
