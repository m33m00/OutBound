import { searchRoutes, type Flight } from '@/engine';

import type { LiveSchedulesResponse } from '../../../supabase/functions/_shared/schedules';
import type { Fetcher } from '../airportStatus';
import { createScheduleProvider, fetchDepartures, readScheduleSource } from '../schedules';

const CONFIG = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
const H = 3_600_000;
/** 2026-10-30 08:00 CDT. */
const NOW = Date.UTC(2026, 9, 30, 13);

const flight = (airline: string, num: string, from: string, to: string, departUtc: number, blockMin: number): Flight => ({
  id: `${airline}${num}-2026-10-30-${from}`,
  airline,
  flightNumber: num,
  from,
  to,
  departUtc,
  arriveUtc: departUtc + blockMin * 60_000,
});

/** Fake live-schedules over a fixed table; records every URL asked for. */
function fakeServer(flights: Flight[], fail: Set<string> = new Set()) {
  const urls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    urls.push(url);
    const p = new URL(url).searchParams;
    const airport = p.get('airport')!;
    if (fail.has(airport)) return { ok: false, status: 502, json: async () => ({}) };
    const from = Number(p.get('from'));
    const to = Number(p.get('to'));
    const body: LiveSchedulesResponse = {
      airport,
      fromUtc: from,
      toUtc: to,
      flights: flights.filter((f) => f.from === airport && f.departUtc >= from && f.departUtc < to),
      pulledAt: '2026-10-30T09:00:00Z',
      asOf: '2026-10-30T13:00:00Z',
    };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetcher, urls };
}

describe('readScheduleSource', () => {
  const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon' };

  it('is sample unless switched on with a Supabase config', () => {
    expect(readScheduleSource({})).toBe('sample');
    expect(readScheduleSource(env)).toBe('sample');
    expect(readScheduleSource({ EXPO_PUBLIC_SCHEDULES: 'live' })).toBe('sample');
    expect(readScheduleSource({ ...env, EXPO_PUBLIC_SCHEDULES: 'on' })).toBe('sample');
    expect(readScheduleSource({ ...env, EXPO_PUBLIC_SCHEDULES: 'live' })).toBe('live');
  });
});

describe('fetchDepartures', () => {
  it('calls live-schedules with the anon key', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = [];
    const fetcher: Fetcher = async (url, init) => {
      calls.push({ url, headers: init?.headers });
      return { ok: true, status: 200, json: async () => ({ flights: [] }) };
    };
    await fetchDepartures('DAL', 1.4, 9.6, CONFIG, fetcher);
    expect(calls[0].url).toBe('https://x.supabase.co/functions/v1/live-schedules?airport=DAL&from=1&to=10');
    expect(calls[0].headers).toEqual({ apikey: 'anon', Authorization: 'Bearer anon' });
  });

  it('throws on a non-OK answer', async () => {
    const fetcher: Fetcher = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchDepartures('DAL', 0, 1, CONFIG, fetcher)).rejects.toThrow('live-schedules 429');
  });
});

describe('createScheduleProvider', () => {
  const table = [
    flight('WN', '311', 'DAL', 'DEN', NOW + 2 * H, 125),
    flight('WN', '1205', 'DAL', 'LAX', NOW + 3 * H, 200),
    flight('UA', '900', 'DEN', 'LAX', NOW + 6 * H, 150),
  ];

  it('returns departures and reuses them inside the cache window', async () => {
    let clock = NOW;
    const s = fakeServer(table);
    const p = createScheduleProvider({ config: CONFIG, fetcher: s.fetcher, now: () => clock });
    expect((await p.getDepartures('DAL', NOW, NOW + 24 * H)).map((f) => f.flightNumber)).toEqual(['311', '1205']);
    await p.getDepartures('DAL', NOW, NOW + 24 * H);
    expect(s.urls).toHaveLength(1);
    clock += 16 * 60_000;
    await p.getDepartures('DAL', NOW, NOW + 24 * H);
    expect(s.urls).toHaveLength(2);
  });

  it('does not cache a failed read', async () => {
    const fail = new Set(['DAL']);
    const s = fakeServer(table, fail);
    const p = createScheduleProvider({ config: CONFIG, fetcher: s.fetcher, now: () => NOW });
    await expect(p.getDepartures('DAL', NOW, NOW + H)).rejects.toThrow('live-schedules 502');
    fail.clear();
    expect(await p.getDepartures('DAL', NOW, NOW + 24 * H)).toHaveLength(2);
  });

  it('drops rows outside the window, from another airport or to an unknown airport', async () => {
    const odd = [...table, flight('WN', '88', 'DAL', 'HOU', NOW + H, 60), flight('WN', '7', 'DFW', 'DEN', NOW + H, 90)];
    const fetcher: Fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ flights: [...odd, flight('WN', '1', 'DAL', 'DEN', NOW + 48 * H, 125)] }),
    });
    const p = createScheduleProvider({ config: CONFIG, fetcher, now: () => NOW });
    expect((await p.getDepartures('DAL', NOW, NOW + 24 * H)).map((f) => f.flightNumber)).toEqual(['311', '1205']);
  });

  it('has no seat data yet and knows the app airports', async () => {
    const p = createScheduleProvider({ config: CONFIG, fetcher: fakeServer(table).fetcher });
    expect(await p.getSeatReports('WN311-2026-10-30-DAL')).toEqual([]);
    expect(p.getAirport('DAL')?.tz).toBe('America/Chicago');
    expect(p.getAirport('XXX')).toBeUndefined();
  });

  it('drives a real search: nonstop and one-stop routes with Unknown seats', async () => {
    const s = fakeServer(table);
    const p = createScheduleProvider({ config: CONFIG, fetcher: s.fetcher, now: () => NOW });
    const out = await searchRoutes(p, { origin: 'DAL', destination: 'LAX', date: '2026-10-30' }, { now: NOW });
    expect(out.results.map((r) => r.pathKey)).toEqual(['DAL>DEN>LAX', 'DAL>LAX']); // departure order: the DEN connection leaves first
    expect(out.results.every((r) => r.tier === 'unknown')).toBe(true);
    // One read per airport the search touched, not one per flight.
    const airports = s.urls.map((u) => new URL(u).searchParams.get('airport'));
    expect(new Set(airports).size).toBe(airports.length);
  });
});
