import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { AIRPORTS, createMemoryProvider, searchItineraries, zonedToUtc, type Airport } from '@/engine';

import { ResultRow } from '../ResultRow';
import { LANDMARK_IMAGES, SKETCH_H, SKETCH_W, STATE_FRAMES, STATE_IMAGES } from '../sketchAssets';
import { resetDrawnSketches, TicketSketchArt, ticketSketch } from '../TicketPaper';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);
const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
const host = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);
const flat = (st: unknown) => StyleSheet.flatten(st as never) ?? {};

async function trip(to = 'DEN') {
  const provider = createMemoryProvider(
    [{ id: 'F1', airline: 'WN', flightNumber: '1', from: 'BNA', to, departUtc: at('09:00'), arriveUtc: at('11:50') }],
    {},
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: to, date: '2026-10-20' }, { now: NOW });
  return it;
}

const STATES = (
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA ' +
  'RI SC SD TN TX UT VT VA WA WV WI WY'
).split(' ');

// Round 221 (John: "Landmark sketch but a little more detailed?", "And different for each one subtly",
// "Sure lets go with this and can it be animated?").
describe('landmark sketches on paper grain tickets (round 221)', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => resetDrawnSketches());
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  it('every airport in the app has its own landmark', () => {
    for (const code of Object.keys(AIRPORTS)) expect(ticketSketch(code)?.kind).toBe('landmark');
    const images = Object.values(LANDMARK_IMAGES);
    expect(new Set(images).size).toBe(images.length);
  });

  it('a US airport without one gets its state with the airport circled inside the sketch box', () => {
    for (const s of STATES) {
      expect(STATE_IMAGES[s]).toBeDefined();
      expect(STATE_FRAMES[s]).toBeDefined();
    }
    const airports: Record<string, Airport> = {
      MAF: {
        code: 'MAF',
        name: 'Midland',
        lon: -102.2019,
        lat: 31.9425,
        tz: 'America/Chicago',
        city: 'Midland',
        region: 'TX',
        country: 'US',
      },
      ANC: {
        code: 'ANC',
        name: 'Anchorage',
        lon: -149.9982,
        lat: 61.1743,
        tz: 'America/Anchorage',
        city: 'Anchorage',
        region: 'AK',
        country: 'US',
      },
      LHR: { code: 'LHR', name: 'London Heathrow', lon: -0.4543, lat: 51.47, tz: 'Europe/London', city: 'London', country: 'GB' },
    } as Record<string, Airport>;
    for (const code of ['MAF', 'ANC']) {
      const s = ticketSketch(code, airports);
      expect(s?.kind).toBe('state');
      if (s?.kind !== 'state') continue;
      expect(s.dot.x).toBeGreaterThan(0);
      expect(s.dot.x).toBeLessThan(SKETCH_W);
      expect(s.dot.y).toBeGreaterThan(0);
      expect(s.dot.y).toBeLessThan(SKETCH_H);
    }
    // Outside the US the ticket keeps its grain alone.
    expect(ticketSketch('LHR', airports)).toBeNull();
    expect(ticketSketch('XXX', airports)).toBeNull();
  });

  it('draws in once, left to right, and not again when the same ticket shows later', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const sketch = ticketSketch('DEN')!;
    // Where the wipe stands: every sliding layer's offset, as drawn.
    const shifts = () =>
      r!.root
        .findAll((n) => typeof n.type === 'string')
        .map(
          (n) =>
            (flat(n.props.style).transform as { translateX?: number }[] | undefined)?.find((t) => 'translateX' in t)?.translateX,
        )
        .filter((x): x is number => typeof x === 'number');
    await act(async () => {
      r = create(<TicketSketchArt sketch={sketch} drawKey="A" ink="#000" scheme="light" />);
    });
    // The first time, the window starts closed and opens from the left.
    expect(shifts()).toEqual([-SKETCH_W, SKETCH_W]);
    act(() => r!.unmount());
    r = undefined;
    // Shown again (say, scrolling back up): already drawn, so it sits there with nothing left to run.
    await act(async () => {
      r = create(<TicketSketchArt sketch={sketch} drawKey="A" ink="#000" scheme="light" />);
    });
    expect(shifts()).toEqual([0, 0]);
  });

  it('with Reduce Motion on it only fades in, with no wipe', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await act(async () => {
      r = create(<TicketSketchArt sketch={ticketSketch('SEA')!} drawKey="B" ink="#000" scheme="dark" />);
    });
    const moving = r!.root.findAll(
      (n) => typeof n.type === 'string' && JSON.stringify(flat(n.props.style).transform ?? []).includes('translateX'),
    );
    expect(moving).toHaveLength(0);
  });

  it('a results ticket carries the grain, a warmer stub and its destination sketch; the route card does not', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const it = await trip('DEN');
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} />);
    });
    expect(host(r!, 'ticket-grain')).toHaveLength(1);
    // The perforation's place arrives with layout, then the stub tone and the sketch follow it.
    const perf = r!.root.findAll(
      (n) => typeof n.type === 'string' && typeof n.props.onLayout === 'function' && n.props.collapsable === false,
    );
    await act(async () => {
      for (const p of perf) p.props.onLayout({ nativeEvent: { layout: { x: 0, y: 70, width: 300, height: 14 } } });
    });
    expect(host(r!, 'ticket-stub-tone')).toHaveLength(1);
    expect(flat(host(r!, 'ticket-stub-tone')[0].props.style).top).toBe(77);
    expect(host(r!, 'ticket-sketch')).toHaveLength(1);
    act(() => r!.unmount());
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} />);
    });
    expect(host(r!, 'ticket-paper')).toHaveLength(0);
    expect(host(r!, 'ticket-sketch')).toHaveLength(0);
  });
});
