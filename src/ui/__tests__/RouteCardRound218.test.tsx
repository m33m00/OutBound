import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { AIRPORTS, createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { computeLeaveBy } from '@/search/leaveBy';

import { RequestLoadsBar } from '../RequestLoadsBar';
import { ResultRow } from '../ResultRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);
const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');

async function nonstop() {
  const provider = createMemoryProvider(
    [{ id: 'F1', airline: 'WN', flightNumber: '1', from: 'BNA', to: 'DEN', departUtc: at('09:00'), arriveUtc: at('11:50') }],
    {},
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'DEN', date: '2026-10-20' }, { now: NOW });
  return it;
}

const host = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);
const flat = (st: unknown) => StyleSheet.flatten(st as never) ?? {};

// Round 218 (John, on the opened DAL to MIA route: "Fix all of them").
describe('opened route page, calmer (round 218)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('a nonstop shows no credit box, no second flight length, no gray box, plain codes and a small seat dash', async () => {
    const it = await nonstop();
    await act(async () => {
      r = create(
        <ResultRow
          itinerary={it}
          selected
          large
          now={NOW}
          onPress={jest.fn()}
          onLegPress={jest.fn()}
          legPicks={{ locked: [true], checked: [true], onToggle: jest.fn() }}
        />,
      );
    });
    // The button below already says "Request Loads for 1 credit".
    expect(r!.root.findAll((n) => n.props.testID === 'leg-credit-0')).toHaveLength(0);
    // The header says "Nonstop 2h 50m"; the line under it doesn't repeat it.
    expect(host(r!, 'leg-length')).toHaveLength(0);
    // No gray box inside the white ticket.
    const box = host(r!, 'leg-box')[0];
    expect(flat(box.props.style).backgroundColor).toBeUndefined();
    // Airport codes are plain text, no bubble.
    for (const code of host(r!, 'leg-code')) {
      const st = flat(code.props.style);
      expect(st.backgroundColor).toBeUndefined();
      expect(st.borderWidth).toBeUndefined();
    }
    // No seats reported: a small dash, not an empty ring.
    const dot = host(r!, 'leg-dot')[0];
    expect(flat(dot.props.style).borderWidth).toBeUndefined();
    expect(host(r!, 'leg-dot-seats')[0].props.children).toBe('–');
  });

  it('the pinned Request bar has no line above it', () => {
    act(() => {
      r = create(<RequestLoadsBar picked={1} locked={1} credits={1} onRequest={jest.fn()} onAnswerLoads={jest.fn()} />);
    });
    expect(flat(host(r!, 'request-loads')[0].props.style).borderTopWidth).toBeUndefined();
  });

  it('far from the airport, the rough guess gives way to when to be there (no 8 hour drives)', () => {
    const BNA = AIRPORTS.BNA;
    const base = { airport: BNA, departUtc: at('09:00'), bufferMin: 75, now: at('05:00') };
    // About 330 km away (Knoxville): no live drive time, so no guess.
    const far = { lat: 35.96, lon: -83.92, at: at('05:00') };
    expect(computeLeaveBy({ ...base, location: far }).kind).toBe('beAt');
    // A real drive time from a maps service still counts out there.
    expect(computeLeaveBy({ ...base, location: far, liveDriveMin: 120 }).kind).toBe('leaveBy');
    // Across town, the rough guess still shows.
    const near = { lat: 36.1627, lon: -86.7816, at: at('05:00') };
    expect(computeLeaveBy({ ...base, location: near }).kind).toBe('leaveBy');
  });
});

// Round 219 (John picked option 1 of the destination mockups: "I like this one").
describe('results ticket by destination (round 219)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('draws a thin destination stripe and, under the perforation, a faint tint in the same color', async () => {
    const it = await nonstop();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} />);
    });
    const edge = host(r!, 'ticket-tone-edge');
    expect(edge).toHaveLength(1);
    // DEN is the mountains: pine.
    expect(flat(edge[0].props.style).backgroundColor).toBe('#557A6A');
    expect(flat(edge[0].props.style).width).toBeLessThanOrEqual(4);
    // The tint waits for the perforation's place, then starts there.
    expect(host(r!, 'ticket-tone-tint')).toHaveLength(0);
    const perf = r!.root.findAll(
      (n) => typeof n.type === 'string' && typeof n.props.onLayout === 'function' && n.props.collapsable === false,
    );
    await act(async () => {
      for (const p of perf) p.props.onLayout({ nativeEvent: { layout: { x: 0, y: 60, width: 300, height: 12 } } });
    });
    const tint = host(r!, 'ticket-tone-tint');
    expect(tint).toHaveLength(1);
    const st = flat(tint[0].props.style);
    expect(st.top).toBe(66);
    expect(String(st.backgroundColor)).toMatch(/^rgba\(85,122,106,0\.\d+\)$/);
  });

  it('the opened route card keeps its own look, with no stripe', async () => {
    const it = await nonstop();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} />);
    });
    expect(host(r!, 'ticket-tone-edge')).toHaveLength(0);
  });
});
