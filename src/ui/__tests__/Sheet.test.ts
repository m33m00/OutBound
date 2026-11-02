import { FLICK_SPEED, growFit, halfSnap, pickSnap, sheetMode, SNAP_SPRING } from '../Sheet';

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

describe('middle stop fits the search panel (John, 2026-11-01: had to scroll to Find Routes)', () => {
  it('is about half until measured, grows to fit the content, and stays under the full stop', () => {
    expect(halfSnap(800, 0, 790)).toBe(384);
    expect(halfSnap(800, 300, 790)).toBe(384);
    expect(halfSnap(800, 455.2, 790)).toBe(456);
    expect(halfSnap(800, 900, 790)).toBe(789);
  });
});

describe('drawer fit holds still (John, 2026-11-01: the globe re-zoomed on a swap)', () => {
  it('only grows within one layout, so a row coming and going does not move the drawer', () => {
    let f = growFit({ key: '', height: 0 }, 'plain', 360);
    f = growFit(f, 'plain', 300);
    expect(f.height).toBe(360);
    f = growFit(f, 'plain', 380);
    expect(f.height).toBe(380);
    // The location card going away is a new layout: measure afresh.
    expect(growFit({ key: 'card', height: 520 }, 'plain', 360)).toEqual({ key: 'plain', height: 360 });
  });
});

describe('home panel mode (John, 2026-11-02: the results list should be the screen until a route is picked)', () => {
  it('the results list fills the screen, fixed and square, whatever size the panel was', () => {
    for (const index of [0, 1, 2]) {
      expect(sheetMode({ showResults: true, routeOpen: false, tallRoute: false, index })).toEqual({
        index: 2,
        locked: true,
        flush: true,
      });
    }
  });

  it('a picked route brings the globe back: the route size, locked, rounded', () => {
    expect(sheetMode({ showResults: true, routeOpen: true, tallRoute: false, index: 2 })).toEqual({
      index: 1,
      locked: true,
      flush: false,
    });
    expect(sheetMode({ showResults: true, routeOpen: true, tallRoute: true, index: 0 })).toEqual({
      index: 2,
      locked: true,
      flush: false,
    });
  });

  it('the search panel moves freely at the size it was left', () => {
    expect(sheetMode({ showResults: false, routeOpen: false, tallRoute: false, index: 0 })).toEqual({
      index: 0,
      locked: false,
      flush: false,
    });
  });
});
