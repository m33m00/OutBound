import { destinationTone, TONE_COLOR, withAlpha } from '../destinationTone';

// Round 219 (John picked option 1 of the destination mockups: "I like this one").
describe('destination tone', () => {
  it('gives each region its own quiet color', () => {
    expect(destinationTone('MIA')).toBe('coast');
    expect(destinationTone('DEN')).toBe('mountain');
    expect(destinationTone('LAX')).toBe('desert');
    expect(destinationTone('LGA')).toBe('northeast');
    expect(destinationTone('SEA')).toBe('northwest');
    expect(destinationTone('ORD')).toBe('heartland');
    expect(destinationTone('ATL')).toBe('south');
    expect(destinationTone('ZZZ')).toBe('abroad');
  });

  it('keeps every color muted and away from boarding blue and the canceled red', () => {
    for (const hex of Object.values(TONE_COLOR)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Saturation stays low enough to read as a tint, not a signal.
      expect((max - min) / max).toBeLessThan(0.6);
      // Never blue-led like boarding blue.
      expect(b > r + 40 && b > g + 40).toBe(false);
    }
  });

  it('writes a color at a strength', () => {
    expect(withAlpha('#D9826B', 0.09)).toBe('rgba(217,130,107,0.09)');
  });
});
