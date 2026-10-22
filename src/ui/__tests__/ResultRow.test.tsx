import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { flightLookupKey, type FlightStatus } from '@/live';
import { legLookup, rowStatus } from '@/search/statusTags';

import { ResultRow } from '../ResultRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);

async function fullItinerary() {
  const departUtc = zonedToUtc('2026-10-20', '09:00', 'America/Chicago');
  const provider = createMemoryProvider(
    [{ id: 'F1', airline: 'AA', flightNumber: '1', from: 'BNA', to: 'LAX', departUtc, arriveUtc: departUtc + 260 * 60_000 }],
    { F1: [{ source: 'reported', openSeats: 4, listed: 9, asOf: NOW }] },
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
  return it;
}

describe('ResultRow', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('renders tier word, badge slot and a single accessible label; full routes say Full', async () => {
    const it = await fullItinerary();
    const onPress = jest.fn();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={onPress} />);
    });
    const root = r!.root;
    const button = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(button.props.accessibilityLabel).toContain('Full route');
    expect(button.props.accessibilityState).toEqual({ selected: false });
    expect(root.findAll((n) => n.props.testID === 'badge-slot').length).toBeGreaterThan(0);
    const texts = root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Full · no open seats · reported just now');
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledWith(it.id);
  });

  it('shows the delay badge and exposes details as a VoiceOver action', async () => {
    const it = await fullItinerary();
    const onImpact = jest.fn();
    const impact = {
      level: 'likelyDelays' as const,
      asOf: new Date(NOW - 5 * 60_000).toISOString(),
      stale: false,
      stations: [
        {
          code: 'LAX',
          role: 'destination' as const,
          level: 'likelyDelays' as const,
          reasons: [{ source: 'FAA' as const, text: 'Ground stop', level: 'likelyDelays' as const }],
          asOf: new Date(NOW - 5 * 60_000).toISOString(),
          stale: false,
          noForecast: false,
        },
      ],
    };
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} impact={impact} onImpactPress={onImpact} />);
    });
    const root = r!.root;
    const row = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityLabel).toContain('Likely delays at LAX: Ground stop');
    expect(row.props.accessibilityActions).toEqual([{ name: 'impact', label: 'Delay and weather details' }]);
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'impact' } }));
    expect(onImpact).toHaveBeenCalledWith(it.id);
    const texts = root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Likely delays · 5m ago');
    const pill = root.findAll((n) => n.props.hitSlop != null)[0];
    expect(pill.props.hitSlop).toEqual({ top: 11, bottom: 11, left: 10, right: 10 });
  });

  it('shows Checking… while live data loads', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} impactLoading />);
    });
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Checking…');
  });

  const live = (it: Awaited<ReturnType<typeof fullItinerary>>, state: FlightStatus['state'], lateMin = 0): FlightStatus => {
    const f = it.legs[0].flight;
    const d = new Date(f.departUtc).toISOString();
    return {
      flightNumber: 'AA1',
      state,
      departure: { airport: 'BNA', scheduledUtc: d, estimatedUtc: lateMin ? new Date(f.departUtc + lateMin * 60_000).toISOString() : null, actualUtc: null, delayMin: lateMin || null, terminal: null, gate: null },
      arrival: { airport: 'LAX', scheduledUtc: null, estimatedUtc: null, actualUtc: null, delayMin: null, terminal: null, gate: null },
      providerUpdatedAt: null,
    };
  };
  const statusFor = (it: Awaited<ReturnType<typeof fullItinerary>>, s: FlightStatus) =>
    rowStatus(it, { [flightLookupKey(legLookup(it.legs[0].flight))]: s }, { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 });
  const strings = (root: ReactTestRenderer['root']) =>
    root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

  it('delayed: violet tag, old time struck through, new time, spoken in the row label', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'delayed', 25))} />);
    });
    const root = r!.root;
    expect(strings(root)).toContain('Delayed 25m');
    const struck = root.findAll((n) => (n.type as unknown) === 'Text' && [n.props.style].flat(3).some((st: { textDecorationLine?: string } | undefined) => st?.textDecorationLine === 'line-through'));
    // Leg 0's old time is struck once, in the top time line only (not again on the leg line).
    expect(struck).toHaveLength(1);
    const row = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityLabel).toContain('Delayed 25 minutes, was 9:00 AM, now 9:25 AM');
    // The weather/FAA badge slot stays separate from status tags.
    expect(root.findAll((n) => n.props.testID === 'badge-slot')[0].findAll((n) => n.props.children === 'Delayed 25m')).toHaveLength(0);
  });

  it('canceled: tag word and spoken text; departed: gray tag', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'canceled'))} />);
    });
    expect(strings(r!.root)).toContain('Canceled');
    expect(r!.root.findAll((n) => n.props.accessibilityRole === 'button')[0].props.accessibilityLabel).toContain('Canceled, was 9:00 AM');
    await act(async () => {
      r!.update(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'departed'))} />);
    });
    expect(strings(r!.root)).toContain('Departed');
  });
});
