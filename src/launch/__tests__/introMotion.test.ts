import {
  ICON,
  INTRO_MS,
  MARK_BOX,
  REDUCED_INTRO_MS,
  TIMING,
  WORD,
  introFrame,
  introLayout,
  letterAt,
  paramAtLength,
  planeCenterAt,
  routePoint,
  skipTo,
  splashDotWidth,
} from '../introMotion';

describe('launch intro motion', () => {
  it('starts on a blank panel with nothing drawn', () => {
    const f = introFrame(0);
    expect(f.dot).toBe(0);
    expect(f.drawn).toBe(0);
    expect(f.plane.opacity).toBe(0);
    expect(f.settle).toBe(0);
    expect(f.lift).toBe(0);
    expect(f.letters.every((l) => l.char === '')).toBe(true);
  });

  it('pops the dot, draws the route, then lands every letter before take-off', () => {
    const before = introFrame(TIMING.exit.start - 1);
    expect(before.dot).toBeCloseTo(1, 5);
    expect(before.drawn).toBeCloseTo(1, 5);
    expect(before.settle).toBeCloseTo(1, 5);
    expect(before.letters.map((l) => l.char).join('')).toBe(WORD);
    expect(before.letters.every((l) => l.landed && l.flip === 1)).toBe(true);
    expect(before.lift).toBe(0);
  });

  it('spins a letter through other letters before it lands', () => {
    const start = TIMING.lettersStart;
    const seen = new Set<string>();
    for (let t = start; t < start + TIMING.letterSpin; t += TIMING.flapEvery) seen.add(letterAt(0, t).char);
    expect(seen.size).toBeGreaterThan(2);
    expect(seen.has('O')).toBe(false);
    expect(letterAt(0, start + TIMING.letterSpin).char).toBe('O');
    // Later letters wait their turn.
    expect(letterAt(7, start).char).toBe('');
  });

  it('flies the plane off and lifts the panel away, then finishes', () => {
    const mid = introFrame(TIMING.exit.start + TIMING.exit.ms * 0.8);
    const resting = planeCenterAt(1);
    expect(mid.plane.at.x).toBeGreaterThan(resting.x);
    expect(mid.plane.at.y).toBeLessThanOrEqual(resting.y + 1);
    expect(mid.lift).toBeGreaterThan(0.5);
    expect(introFrame(INTRO_MS).done).toBe(true);
    expect(introFrame(INTRO_MS - 1).done).toBe(false);
  });

  it('keeps the whole intro short', () => {
    expect(INTRO_MS).toBeLessThanOrEqual(2500);
  });

  it('skips to the take-off on a tap, never backwards', () => {
    expect(skipTo(300)).toBe(TIMING.exit.start);
    expect(skipTo(TIMING.exit.start + 100)).toBe(TIMING.exit.start + 100);
  });

  it('with Reduce Motion shows the finished mark still, then fades', () => {
    const f = introFrame(0, true);
    expect(f.drawn).toBe(1);
    expect(f.letters.map((l) => l.char).join('')).toBe(WORD);
    expect(f.lift).toBe(0);
    expect(f.opacity).toBe(1);
    expect(introFrame(TIMING.reducedHold + TIMING.reducedFade / 2, true).opacity).toBeCloseTo(0.5, 5);
    expect(introFrame(REDUCED_INTRO_MS, true).done).toBe(true);
  });

  it('measures the route by length, the way Skia trims it', () => {
    expect(paramAtLength(0)).toBe(0);
    expect(paramAtLength(1)).toBeCloseTo(1, 5);
    expect(routePoint(0)).toEqual(ICON.start);
    const a = routePoint(paramAtLength(0.25));
    const b = routePoint(paramAtLength(0.5));
    const c = routePoint(paramAtLength(0.75));
    const d1 = Math.hypot(b.x - a.x, b.y - a.y);
    const d2 = Math.hypot(c.x - b.x, c.y - b.y);
    expect(Math.abs(d1 - d2) / d1).toBeLessThan(0.08);
  });

  it('fits the mark and wordmark on a small and a large phone', () => {
    for (const [w, h] of [
      [375, 667],
      [440, 956],
    ]) {
      const l = introLayout(w, h);
      const left = l.originTo.x + MARK_BOX.minX * l.scale;
      const right = l.originTo.x + MARK_BOX.maxX * l.scale;
      expect(left).toBeGreaterThan(0);
      expect(right).toBeLessThan(w);
      expect(l.wordTop + l.tileH).toBeLessThan(h);
      expect(l.tileW * WORD.length + l.tileGap * (WORD.length - 1)).toBeLessThan(w - 32);
      // At the first frame the dot is at the screen's centre, where the native splash draws it.
      expect(l.originFrom.x + ICON.start.x * l.scale).toBeCloseTo(w / 2, 5);
      expect(l.originFrom.y + ICON.start.y * l.scale).toBeCloseTo(h / 2, 5);
    }
  });

  it('sizes the native splash dot like the intro dot', () => {
    expect(splashDotWidth(393, 852)).toBeGreaterThan(30);
    expect(splashDotWidth(393, 852)).toBeLessThan(50);
  });
});
