import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { clearFlightStatusMemo, type FlightStatusResponse } from '@/live';
import { parseFlightStatus } from '../../../supabase/functions/_shared/flightStatus';
import { ADB_DELAYED } from '@/live/fixtures/flight-status-samples';

import { FlightStatusSheet } from '../FlightStatusSheet';
import { ageText, delayText, movementTimes, placeText } from '../flightStatusText';
import { ResultRow } from '../ResultRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 21, 12);

async function itinerary() {
  const departUtc = zonedToUtc('2026-10-22', '09:00', 'America/Chicago');
  const provider = createMemoryProvider(
    [{ id: 'F1', airline: 'DL', flightNumber: '2210', from: 'BNA', to: 'LAX', departUtc, arriveUtc: departUtc + 260 * 60_000 }],
    { F1: [{ source: 'reported', openSeats: 4, listed: 1, asOf: NOW }] },
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-22' }, { now: NOW });
  return it;
}

describe('flight status text', () => {
  const status = parseFlightStatus(ADB_DELAYED, { flightNumber: 'DL2210', date: '2026-10-22', from: null, departMs: null })!;
  it('delay words', () => {
    expect(delayText(50)).toBe('50 min late');
    expect(delayText(-9)).toBe('9 min early');
    expect(delayText(3)).toBe('On time');
    expect(delayText(null)).toBeNull();
  });
  it('times and gates', () => {
    expect(movementTimes(status.departure, 'America/New_York')).toContain('Estimated');
    expect(placeText(status.departure)).toBe('Terminal S · Gate B22');
    expect(placeText(status.arrival)).toBe('Terminal A');
    expect(placeText({ ...status.arrival, terminal: null })).toBe('Gate not posted yet');
  });
  it('age line always present, with the stale reason and never a spend-cap pause (Q-049)', () => {
    const r: FlightStatusResponse = { flightNumber: 'DL2210', date: '2026-10-22', state: 'ok', stale: false, paused: false, fetchedAt: new Date(NOW - 4 * 60_000).toISOString(), status };
    expect(ageText(r, NOW)).toBe('Updated 4m ago');
    expect(ageText({ ...r, stale: true }, NOW)).toBe('Updated 4m ago · may be out of date');
    expect(ageText({ ...r, stale: true, paused: true }, NOW)).toBe('Updated 4m ago · may be out of date');
    expect(ageText({ ...r, paused: true }, NOW)).not.toContain('paused');
  });
});

describe('leg tap and sheet', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    clearFlightStatusMemo();
  });

  it('a leg is its own 44pt button that reports the flight; the row still selects', async () => {
    const it = await itinerary();
    const onPress = jest.fn();
    const onLegPress = jest.fn();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={onPress} onLegPress={onLegPress} />);
    });
    const leg = r!.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Flight status,'))[0];
    expect(leg.props.accessibilityRole).toBe('button');
    act(() => leg.props.onPress());
    expect(onLegPress).toHaveBeenCalledWith(it.legs[0].flight);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('no leg button without a handler', async () => {
    const it = await itinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} />);
    });
    expect(r!.root.findAll((n) => String(n.props.accessibilityLabel).startsWith('Flight status,'))).toHaveLength(0);
  });

  it('sheet shows state, times, gates and age', async () => {
    const it = await itinerary();
    const status = parseFlightStatus(ADB_DELAYED, { flightNumber: 'DL2210', date: '2026-10-22', from: null, departMs: null });
    const body: FlightStatusResponse = { flightNumber: 'DL2210', date: '2026-10-22', state: 'ok', stale: true, paused: false, fetchedAt: new Date(NOW - 7 * 60_000).toISOString(), status };
    const fetcher = jest.fn(async () => ({ ok: true, status: 200, json: async () => body }));
    await act(async () => {
      r = create(
        <FlightStatusSheet flight={it.legs[0].flight} now={NOW} onClose={jest.fn()} liveOptions={{ fetcher, config: { baseUrl: 'https://x.supabase.co', anonKey: 'a' } }} />,
      );
    });
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(texts).toContain('Delayed');
    expect(texts).toContain('50 min late');
    expect(texts).toContain('Terminal S · Gate B22');
    expect(texts).toContain('Updated 7m ago · may be out of date');
  });

  it('makes no request while closed', async () => {
    const fetcher = jest.fn();
    await act(async () => {
      r = create(<FlightStatusSheet flight={null} now={NOW} onClose={jest.fn()} liveOptions={{ fetcher, config: { baseUrl: 'https://x', anonKey: 'a' } }} />);
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
