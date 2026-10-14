/**
 * Preview lifecycle through the hook, with fake timers (requestAnimationFrame
 * and performance.now are faked), so nothing runs after the test.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { canvasLayerOrder } from '../radar';
import { buildPreviewTimeline, PREVIEW } from '../preview';
import type { MapPreviewRequest, MapPreviewState, RouteLine } from '../types';
import { useFlightPreview, type FlightPreview, type FlightPreviewInput } from '../useFlightPreview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const H = 3600_000;
const T0 = Date.UTC(2026, 9, 14, 18, 0);
const route: RouteLine = {
  id: 'r1',
  legs: [
    { id: 'a', from: [-73.78, 40.64], to: [-87.9, 41.98], fromCode: 'JFK', toCode: 'ORD', tier: 'good', source: 'reported', departUtc: T0, arriveUtc: T0 + 2 * H },
  ],
};
const other: RouteLine = { id: 'r2', legs: [{ ...route.legs[0], id: 'b' }] };
const routes = [route, other];
const total = buildPreviewTimeline(route)!.total;

let renderer: ReactTestRenderer | null = null;
let latest!: FlightPreview;
let states: MapPreviewState[] = [];
let starts: string[] = [];
let renders = 0;
let frames = 0;

function Harness(props: Omit<FlightPreviewInput, 'onPreviewState' | 'onStart'>) {
  renders += 1;
  latest = useFlightPreview({
    ...props,
    onPreviewState: (s) => states.push(s),
    onStart: (id) => starts.push(id),
    onFrame: (s) => {
      if (s) frames += 1;
    },
  });
  return null;
}

function render(p: Partial<FlightPreviewInput> & { preview: MapPreviewRequest | null }) {
  const props = { routes, selectedId: 'r1', reduceMotion: false, ...p };
  act(() => {
    if (renderer) renderer.update(<Harness {...props} />);
    else renderer = create(<Harness {...props} />);
  });
}

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers();
  states = [];
  starts = [];
  renders = 0;
  frames = 0;
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
});

describe('useFlightPreview', () => {
  it('is a no-op when preview is null', () => {
    render({ preview: null });
    advance(1000);
    expect(latest.active).toBe(false);
    expect(latest.skyUtc).toBeNull();
    expect(states).toEqual([]);
    expect(starts).toEqual([]);
  });

  it('plays, moves the sky, hides radar, then reports done and restores radar', () => {
    render({ preview: { routeId: 'r1', nonce: 1 } });
    expect(starts).toEqual(['r1']);
    expect(latest.active).toBe(true);
    expect(states[0]).toMatchObject({ routeId: 'r1', phase: 'playing', simUtc: T0, progress: 0 });
    expect(canvasLayerOrder({ night: true, radar: true, routes: true, marks: true, plane: true, previewing: latest.active })).not.toContain('radar');

    advance(PREVIEW.startDelayMs + total / 2);
    expect(latest.skyUtc).toBeGreaterThan(T0);
    expect(latest.skyUtc).toBeLessThan(T0 + 2 * H);
    // ~5 Hz reporting at most.
    const playing = states.filter((s) => s.phase === 'playing').length;
    expect(playing).toBeLessThanOrEqual(Math.ceil((PREVIEW.startDelayMs + total / 2) / PREVIEW.reportMs) + 1);

    advance(total / 2 + PREVIEW.holdMs + 100);
    expect(latest.active).toBe(false);
    expect(latest.skyUtc).toBeNull();
    expect(states[states.length - 1]).toEqual({ routeId: 'r1', phase: 'done', simUtc: T0 + 2 * H, progress: 1 });
    expect(canvasLayerOrder({ night: true, radar: true, routes: true, marks: true, previewing: latest.active })).toContain('radar');

    // Same request again does not replay.
    render({ preview: { routeId: 'r1', nonce: 1 } });
    advance(500);
    expect(latest.active).toBe(false);
  });

  it('touch cancel reports cancelled once and returns true only while playing', () => {
    render({ preview: { routeId: 'r1', nonce: 1 } });
    advance(1000);
    let r = false;
    act(() => {
      r = latest.cancel();
    });
    expect(r).toBe(true);
    expect(latest.active).toBe(false);
    act(() => {
      r = latest.cancel();
    });
    expect(r).toBe(false);
    expect(states.filter((s) => s.phase === 'cancelled')).toHaveLength(1);
  });

  it('cancels on deselect and on a route change', () => {
    render({ preview: { routeId: 'r1', nonce: 1 } });
    render({ preview: { routeId: 'r1', nonce: 1 }, selectedId: null });
    expect(latest.active).toBe(false);
    expect(states[states.length - 1].phase).toBe('cancelled');

    states = [];
    render({ preview: { routeId: 'r1', nonce: 2 }, selectedId: 'r1' });
    expect(latest.active).toBe(true);
    render({ preview: { routeId: 'r1', nonce: 2 }, selectedId: 'r2' });
    expect(latest.active).toBe(false);
    expect(states[states.length - 1].phase).toBe('cancelled');
  });

  it('cancels when the request goes null and restarts on a new nonce', () => {
    render({ preview: { routeId: 'r1', nonce: 1 } });
    render({ preview: null });
    expect(latest.active).toBe(false);
    expect(states[states.length - 1].phase).toBe('cancelled');
    render({ preview: { routeId: 'r1', nonce: 2 } });
    expect(latest.active).toBe(true);
    expect(starts).toEqual(['r1', 'r1']);
  });

  it('under Reduce Motion reports cancelled with simUtc null and never plays', () => {
    render({ preview: { routeId: 'r1', nonce: 1 }, reduceMotion: true });
    advance(1000);
    expect(latest.active).toBe(false);
    expect(starts).toEqual([]);
    expect(states).toEqual([{ routeId: 'r1', phase: 'cancelled', simUtc: null, progress: 0 }]);
  });

  it('stops when Reduce Motion turns on mid-preview', () => {
    render({ preview: { routeId: 'r1', nonce: 1 } });
    render({ preview: { routeId: 'r1', nonce: 1 }, reduceMotion: true });
    expect(latest.active).toBe(false);
    expect(states[states.length - 1].phase).toBe('cancelled');
  });

  it('keeps the sky at real time when the route has no times', () => {
    const bare: RouteLine = { id: 'r3', legs: [{ ...route.legs[0], id: 'c', departUtc: undefined, arriveUtc: undefined }] };
    render({ preview: { routeId: 'r3', nonce: 1 }, routes: [bare], selectedId: 'r3' });
    advance(2000);
    expect(latest.active).toBe(true);
    expect(latest.skyUtc).toBeNull();
    expect(states.every((s) => s.simUtc === null)).toBe(true);
  });

  it('sends the plane every frame without re-rendering per frame (sky at ~9 Hz)', () => {
    const bare: RouteLine = { id: 'r3', legs: [{ ...route.legs[0], id: 'c', departUtc: undefined, arriveUtc: undefined }] };
    render({ preview: { routeId: 'r3', nonce: 1 }, routes: [bare], selectedId: 'r3' });
    const before = renders;
    advance(2000);
    expect(frames).toBeGreaterThan(100); // ~60 Hz
    expect(renders - before).toBe(0); // no sky times: nothing re-renders mid-flight

    renders = 0;
    frames = 0;
    render({ preview: { routeId: 'r1', nonce: 9 } });
    advance(2000);
    expect(frames).toBeGreaterThan(100);
    expect(renders).toBeLessThanOrEqual(2 + Math.ceil(2000 / 110)); // sky updates only
  });
});
