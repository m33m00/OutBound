import { drawProgress, PREVIEW, RIPPLE, rippleAt, SWAY, swayOffset } from '../homeMotionTiming';

describe('home globe motion (John, 2026-11-01)', () => {
  it('the home ripple grows and fades, then rests until the next one', () => {
    expect(rippleAt(0)).toEqual({ grow: 0, alpha: RIPPLE.startAlpha });
    const mid = rippleAt(RIPPLE.growMs / 2)!;
    expect(mid.grow).toBeGreaterThan(RIPPLE.spread / 2);
    expect(mid.alpha).toBeCloseTo(RIPPLE.startAlpha / 2, 5);
    expect(rippleAt(RIPPLE.growMs + 10)).toBeNull();
    expect(rippleAt(RIPPLE.periodMs)).toEqual(rippleAt(0));
    // Soft: never a strong ring.
    expect(RIPPLE.startAlpha).toBeLessThanOrEqual(0.5);
  });

  it('the preview arc draws from nothing to whole, easing in and out', () => {
    expect(drawProgress(0)).toBe(0);
    expect(drawProgress(PREVIEW.drawMs / 2)).toBeCloseTo(0.5, 5);
    expect(drawProgress(PREVIEW.drawMs)).toBe(1);
    expect(drawProgress(PREVIEW.drawMs * 3)).toBe(1);
  });

  it('the idle sway eases in and never turns far from the resting spot', () => {
    expect(swayOffset(0)).toBe(0);
    let most = 0;
    for (let ms = 0; ms < SWAY.periodMs * 2; ms += 250) most = Math.max(most, Math.abs(swayOffset(ms)));
    expect(most).toBeLessThanOrEqual(SWAY.amplitudeDeg);
    expect(most).toBeGreaterThan(SWAY.amplitudeDeg * 0.9);
    // Barely there (John: tone it down): a few degrees, at most a quarter degree a second.
    expect(SWAY.amplitudeDeg).toBeLessThanOrEqual(3);
    expect((2 * Math.PI * SWAY.amplitudeDeg) / (SWAY.periodMs / 1000)).toBeLessThanOrEqual(0.25);
    expect(SWAY.startAfterMs).toBeGreaterThanOrEqual(8000);
    // Slow: under a quarter degree per frame.
    expect(Math.abs(swayOffset(SWAY.rampMs + SWAY.frameMs) - swayOffset(SWAY.rampMs))).toBeLessThan(0.25);
  });
});
