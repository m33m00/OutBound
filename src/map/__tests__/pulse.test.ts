import { PULSE, pulseWindow } from '../pulse';

describe('route pulse (John, 2026-11-01)', () => {
  it('slides from the origin to the destination of a nonstop', () => {
    const at = (share: number) => pulseWindow(share * PULSE.legMs, 0, 1);
    const early = at(0.15);
    const mid = at(0.5);
    const late = at(0.9);
    expect(early.start).toBe(0);
    expect(early.end).toBeGreaterThan(0);
    expect(mid.start).toBeGreaterThan(early.start);
    expect(mid.end).toBeGreaterThan(early.end);
    expect(late.end).toBe(1);
    expect(late.start).toBeGreaterThan(mid.start);
    // Never longer than its set length.
    for (const w of [early, mid, late]) expect(w.end - w.start).toBeLessThanOrEqual(PULSE.length + 1e-9);
  });

  it('runs a connection leg by leg, then rests', () => {
    const first = pulseWindow(PULSE.legMs * 0.5, 0, 2);
    const secondThen = pulseWindow(PULSE.legMs * 0.5, 1, 2);
    expect(first.end).toBeGreaterThan(first.start);
    expect(secondThen).toEqual({ start: 0, end: 0 });
    const second = pulseWindow(PULSE.legMs * 1.5, 1, 2);
    expect(second.end).toBeGreaterThan(second.start);
    expect(pulseWindow(PULSE.legMs * 1.5, 0, 2)).toEqual({ start: 0, end: 0 });
    // Resting after the last leg: nothing drawn anywhere.
    const rest = PULSE.legMs * 2 + PULSE.restMs / 2;
    expect(pulseWindow(rest, 0, 2)).toEqual({ start: 0, end: 0 });
    expect(pulseWindow(rest, 1, 2)).toEqual({ start: 0, end: 0 });
    // And it loops.
    const cycle = 2 * PULSE.legMs + PULSE.restMs;
    expect(pulseWindow(cycle + PULSE.legMs * 0.5, 0, 2)).toEqual(first);
  });
});
