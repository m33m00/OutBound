import { FLICK_SPEED, pickSnap, SNAP_SPRING } from '../Sheet';

// Peek, half, full (pt), like the home screen.
const SNAPS = [120, 380, 700];

describe('sheet snaps (John, 2026-11-01: hard drags felt clunky)', () => {
  it('a hard flick goes to the next size in its direction, never two at once', () => {
    expect(pickSnap(SNAPS, 130, -4000)).toBe(1);
    expect(pickSnap(SNAPS, 390, -4000)).toBe(2);
    expect(pickSnap(SNAPS, 690, 4000)).toBe(1);
    expect(pickSnap(SNAPS, 370, 4000)).toBe(0);
  });

  it('a flick never snaps back against its direction', () => {
    // Just past half on the way up: a flick up still goes to full.
    expect(pickSnap(SNAPS, 400, -FLICK_SPEED)).toBe(2);
    // Just under half on the way down: a flick down goes to peek.
    expect(pickSnap(SNAPS, 360, FLICK_SPEED)).toBe(0);
  });

  it('a flick past the end stays at the end', () => {
    expect(pickSnap(SNAPS, 700, -3000)).toBe(2);
    expect(pickSnap(SNAPS, 120, 3000)).toBe(0);
  });

  it('a slow drag lands on the nearest size', () => {
    expect(pickSnap(SNAPS, 300, 0)).toBe(1);
    expect(pickSnap(SNAPS, 560, 100)).toBe(2);
    expect(pickSnap(SNAPS, 200, -50)).toBe(0);
  });

  it('settles on the native driver without bouncing past the size', () => {
    expect(SNAP_SPRING.useNativeDriver).toBe(true);
    expect(SNAP_SPRING.overshootClamping).toBe(true);
  });
});
