import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { clearFlightStatusMemo, type FlightStatusResponse } from '@/live';
import type { FlightStatusEntry } from '@/live/flightStatus';
import { parseFlightStatus } from '../../../supabase/functions/_shared/flightStatus';
import { ADB_DELAYED } from '@/live/fixtures/flight-status-samples';

import { FlightStatusSheet, type FlightLoadActions } from '../FlightStatusSheet';
import { ageText, delayText, movementTimes, placeText, sampleResponse } from '../flightStatusText';
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

  it('in the route card, a leg is its own 44pt button that reports the flight', async () => {
    const it = await itinerary();
    const onPress = jest.fn();
    const onLegPress = jest.fn();
    await act(async () => {
      // Leg buttons live in the route card, i.e. the selected row (Q-062).
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={onPress} onLegPress={onLegPress} />);
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

describe('sample status in the sheet (design round 4)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    clearFlightStatusMemo();
  });

  const delayedEntry = (departUtc: number, arriveGuess: number): FlightStatusEntry => ({
    flightNumber: 'DL2210',
    state: 'delayed',
    departure: { airport: 'BNA', scheduledUtc: new Date(departUtc).toISOString(), estimatedUtc: new Date(departUtc + 25 * 60_000).toISOString(), actualUtc: null, delayMin: 25, terminal: null, gate: null },
    arrival: { airport: null, scheduledUtc: new Date(arriveGuess).toISOString(), estimatedUtc: new Date(arriveGuess + 25 * 60_000).toISOString(), actualUtc: null, delayMin: 25, terminal: null, gate: null },
    providerUpdatedAt: null,
    asOf: new Date(NOW - 2 * 60_000).toISOString(),
    stale: false,
    delayMin: 25,
  });

  it('sampleResponse moves the arrival to the real schedule, keeping the delay', async () => {
    const f = (await itinerary()).legs[0].flight;
    const res = sampleResponse(delayedEntry(f.departUtc, f.departUtc + 150 * 60_000), f, '2026-10-22');
    expect(res.state).toBe('ok');
    expect(res.fetchedAt).toBe(new Date(NOW - 2 * 60_000).toISOString());
    expect(Date.parse(res.status!.arrival.scheduledUtc!)).toBe(f.arriveUtc);
    expect(Date.parse(res.status!.arrival.estimatedUtc!)).toBe(f.arriveUtc + 25 * 60_000);
    expect(res.status!.arrival.airport).toBe('LAX');
  });

  it('shows the sample like a real status (no label since round 30), asks no server and offers no Refresh', async () => {
    const f = (await itinerary()).legs[0].flight;
    const fetcher = jest.fn();
    await act(async () => {
      r = create(
        <FlightStatusSheet
          flight={f}
          now={NOW}
          onClose={jest.fn()}
          sample={delayedEntry(f.departUtc, f.departUtc + 150 * 60_000)}
          liveOptions={{ fetcher, config: { baseUrl: 'https://x', anonKey: 'a' } }}
        />,
      );
    });
    expect(fetcher).not.toHaveBeenCalled();
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts.some((t) => /sample/i.test(String(t)))).toBe(false);
    expect(texts).not.toContain('Data from AeroDataBox.');
    expect(texts).toContain('Delayed');
    expect(texts).toContain('DL 2210');
    expect(texts).toContain('Updated 2m ago');
    expect(r!.root.findAll((n) => n.props.accessibilityLabel === 'Refresh flight status')).toHaveLength(0);
  });
});

describe('seats card in the flight sheet (design round 32)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    clearFlightStatusMemo();
  });
  const btn = (label: string) =>
    r!.root.find((n) => typeof n.type !== 'string' && n.props.accessibilityLabel === label && n.props.onPress);
  const texts = () => r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);

  const render = async (load: Partial<FlightLoadActions>) => {
    const f = (await itinerary()).legs[0].flight;
    const full: FlightLoadActions = { canReport: true, askState: 'ready', yourReport: null, onAsk: jest.fn(), onReport: jest.fn(), ...load };
    await act(async () => {
      r = create(<FlightStatusSheet flight={f} now={NOW} onClose={jest.fn()} sample={null} liveOptions={{ fetcher: jest.fn(), config: null }} load={full} />);
    });
    return full;
  };

  it('Report Load opens the report page in the same sheet; Submit hands back both numbers and returns', async () => {
    const load = await render({});
    act(() => btn('Report Load').props.onPress());
    expect(texts()).toContain('Report Load');
    const box = r!.root.find((n) => n.props.accessibilityLabel === 'Open seats, On the board' && n.props.onChangeText);
    act(() => box.props.onChangeText('12'));
    act(() => btn('Submit Report').props.onPress());
    expect(load.onReport).toHaveBeenCalledWith(12, 0);
    expect(r!.root.findAll((n) => n.props.testID === 'load-card').length).toBeGreaterThan(0);
  });

  it('Cancel on the report page goes back to the status without reporting', async () => {
    const load = await render({});
    act(() => btn('Report Load').props.onPress());
    act(() => r!.root.find((n) => n.props.testID === 'sheet-action' && n.props.onPress).props.onPress());
    expect(load.onReport).not.toHaveBeenCalled();
    expect(r!.root.findAll((n) => n.props.testID === 'load-card').length).toBeGreaterThan(0);
  });

  it('asks once: Asked is off and points to My Trips', async () => {
    const load = await render({ askState: 'asked' });
    expect(btn('Asked').props.disabled).toBe(true);
    expect(texts()).toContain('Asked. The answer shows in My Trips.');
    expect(load.onAsk).not.toHaveBeenCalled();
  });

  it('outside the report window Report Load is off and says why; your report shows with its age', async () => {
    await render({ canReport: false, yourReport: { open: 18, listed: 3, at: NOW - 5 * 60_000, byYou: true } });
    expect(btn('Report Again').props.disabled).toBe(true);
    expect(texts()).toContain('You reported Good · 18 open · 3 listed · 5m ago');
  });
});
