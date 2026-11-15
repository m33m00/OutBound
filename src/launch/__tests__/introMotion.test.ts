import { planeCenterAt, trailPolygon } from '@/brand/geometry';
import { BOX, TRAIL } from '@/brand/jauntMark';

import { INTRO_MS, LETTER_COUNT, REDUCED_INTRO_MS, TIMING, introFrame, introLayout, letterAt, skipTo } from '../introMotion';

describe('launch intro motion (Jaunt)', () => {
  it('starts on a blank panel with nothing drawn', () => {
    const f = introFrame(0);
    expect(f.letters).toHaveLength(LETTER_COUNT);
    expect(f.letters.every((l) => l.opacity === 0)).toBe(true);
    expect(f.drawn).toBe(0);
    expect(f.plane.opacity).toBe(0);
    expect(f.lift).toBe(0);
  });

  it('raises the letters one after another, then draws the contrail before take-off', () => {
    const early = TIMING.lettersStart + TIMING.letterIn / 2;
    expect(letterAt(0, early).opacity).toBeGreaterThan(letterAt(1, early).opacity);
    expect(letterAt(LETTER_COUNT - 1, TIMING.lettersStart).opacity).toBe(0);
    expect(letterAt(0, early).rise).toBeGreaterThan(0);

    const before = introFrame(TIMING.exit.start - 1);
    expect(before.letters.every((l) => l.opacity === 1 && l.rise === 0)).toBe(true);
    expect(before.drawn).toBeCloseTo(1, 5);
    expect(before.plane.opacity).toBe(1);
    expect(before.lift).toBe(0);
  });

  it('keeps the plane on the tip of the contrail while it draws', () => {
    const mid = introFrame(TIMING.draw.start + TIMING.draw.ms / 2);
    expect(mid.drawn).toBeGreaterThan(0);
    expect(mid.drawn).toBeLessThan(1);
    const tip = trailPolygon(mid.drawn);
    const tipX = (tip[1].x + tip[2].x) / 2;
    expect(mid.plane.at.x).toBeGreaterThan(tipX);
    expect(mid.plane.at.x - tipX).toBeCloseTo(TRAIL.plane.x - TRAIL.head.x, 3);
  });

  it('flies the plane off up and to the right and lifts the panel away, then finishes', () => {
    const mid = introFrame(TIMING.exit.start + TIMING.exit.ms * 0.8);
    const resting = planeCenterAt(1);
    expect(mid.plane.at.x).toBeGreaterThan(resting.x);
    expect(mid.plane.at.y).toBeLessThan(resting.y);
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

  it('with Reduce Motion shows the finished wordmark still, then fades', () => {
    const f = introFrame(0, true);
    expect(f.drawn).toBe(1);
    expect(f.letters.every((l) => l.opacity === 1 && l.rise === 0)).toBe(true);
    expect(f.lift).toBe(0);
    expect(f.opacity).toBe(1);
    expect(introFrame(TIMING.reducedHold + TIMING.reducedFade / 2, true).opacity).toBeCloseTo(0.5, 5);
    expect(introFrame(REDUCED_INTRO_MS, true).done).toBe(true);
  });

  it('fits the wordmark on a small and a large phone, centred', () => {
    for (const [w, h] of [
      [375, 667],
      [440, 956],
    ]) {
      const l = introLayout(w, h);
      const left = l.origin.x + BOX.minX * l.scale;
      const right = l.origin.x + BOX.maxX * l.scale;
      expect(left).toBeGreaterThan(32);
      expect(right).toBeLessThan(w - 32);
      expect((left + right) / 2).toBeCloseTo(w / 2, 5);
      expect(l.origin.y + BOX.minY * l.scale).toBeGreaterThan(0);
      // Sits a little above the middle of the screen.
      const top = l.origin.y + BOX.minY * l.scale;
      const bottom = l.origin.y + BOX.maxY * l.scale;
      expect((top + bottom) / 2).toBeLessThan(h / 2);
      expect((top + bottom) / 2).toBeGreaterThan(h * 0.4);
    }
  });
});
