import * as timing from '../homeMotionTiming';
import { drawProgress, PREVIEW, RIPPLE, rippleAt } from '../homeMotionTiming';

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

  it('has no idle sway: the globe stays still until moved (John, 2026-11-02)', () => {
    expect('SWAY' in timing).toBe(false);
    expect('swayOffset' in timing).toBe(false);
  });
});
