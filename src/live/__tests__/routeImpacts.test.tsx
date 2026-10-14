import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Itinerary } from '@/engine';
import { routeImpacts, useRouteImpacts, type RouteImpactsResult } from '../routeImpacts';
import { sampleRouteImpacts } from '../fixtures/sampleRouteImpacts';
import { weatherKey, type StationWeather } from '../airportWeather';
import type { Fetcher } from '../airportStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const H = 3600_000;
const T0 = Date.parse('2026-10-15T12:00:00Z');
const leg = (from: string, to: string, dep: number, arr: number) =>
  ({ flight: { from, to, departUtc: dep, arriveUtc: arr } }) as unknown as Itinerary['legs'][number];
const itin = (id: string, legs: Itinerary['legs']): Itinerary => ({ id, legs }) as unknown as Itinerary;

// A: BNA>DFW>LAX (connection DFW, destination LAX).  B: BNA>LAX nonstop.  C: ATL>DFW (dest DFW).
const A = itin('A', [leg('BNA', 'DFW', T0, T0 + 2 * H), leg('DFW', 'LAX', T0 + 3 * H, T0 + 6 * H)]);
const B = itin('B', [leg('BNA', 'LAX', T0, T0 + 4 * H)]);
const C = itin('C', [leg('ATL', 'DFW', T0, T0 + 2 * H)]);

const keyDfwConn = weatherKey({ station: 'DFW', fromMs: T0 + 2 * H, toMs: T0 + 3 * H });
const keyLaxA = weatherKey({ station: 'LAX', fromMs: T0 + 5 * H, toMs: T0 + 7 * H });
const keyLaxB = weatherKey({ station: 'LAX', fromMs: T0 + 3 * H, toMs: T0 + 5 * H });
const keyDfwC = weatherKey({ station: 'DFW', fromMs: T0 + H, toMs: T0 + 3 * H });

const wx = (key: string, over: Partial<StationWeather> = {}): StationWeather => ({
  key, station: key.split(':')[0], icao: 'K', windowStart: 0, windowEnd: 0, state: 'ok', level: 'none', reasons: [],
  observedAt: null, issuedAt: null, asOf: '2026-10-15T10:00:00.000Z', raw: null, stale: false, ...over,
});
const faaOf = (status: Record<string, { level: 'caution' | 'likelyDelays'; text?: string }>, over = {}) => ({
  status: Object.fromEntries(
    Object.entries(status).map(([code, s]) => [
      code,
      { code, level: s.level, events: [{ type: s.text === 'stop' ? 'groundStop' : 'delay', reason: 'x', maxMinutes: 30 }] },
    ]),
  ) as never,
  asOf: '2026-10-15T11:00:00.000Z',
  stale: false,
  ...over,
});
const noFaa = { status: {}, asOf: null, stale: false };
const noWx = { results: {}, stale: false };

describe('routeImpacts (pure)', () => {
  it('evaluates connections and destination only, never the origin', () => {
    const r = routeImpacts([A, B], faaOf({ BNA: { level: 'likelyDelays', text: 'stop' } }), noWx);
    expect(r.byId.A.stations.map((s) => [s.code, s.role])).toEqual([['DFW', 'connection'], ['LAX', 'destination']]);
    expect(r.byId.B.stations.map((s) => [s.code, s.role])).toEqual([['LAX', 'destination']]);
    expect(r.byId.A.level).toBe('none');
    expect(r.airports).toEqual([]);
  });

  it('worst of FAA and weather per station; row level is the worst station', () => {
    const r = routeImpacts(
      [A],
      faaOf({ DFW: { level: 'caution' } }),
      { results: { [keyDfwConn]: wx(keyDfwConn, { level: 'likelyDelays', reasons: ['Thunderstorms'] }) }, stale: false },
    );
    const dfw = r.byId.A.stations[0];
    expect(dfw.level).toBe('likelyDelays');
    expect(dfw.reasons.map((x) => [x.source, x.text])).toEqual([['Weather', 'Thunderstorms'], ['FAA', 'Delays up to 30 min']]);
    expect(r.byId.A.stations[1].level).toBe('none');
    expect(r.byId.A.level).toBe('likelyDelays');
  });

  it('asOf is the oldest input; stale if any input is stale', () => {
    const r = routeImpacts(
      [A],
      faaOf({ DFW: { level: 'caution' } }),
      { results: { [keyLaxA]: wx(keyLaxA, { level: 'caution', reasons: ['Low clouds'], asOf: '2026-10-15T09:00:00.000Z', stale: true }) }, stale: true },
    );
    expect(r.byId.A.stations[0].asOf).toBe('2026-10-15T11:00:00.000Z');
    expect(r.byId.A.stations[0].stale).toBe(false);
    expect(r.byId.A.stations[1].asOf).toBe('2026-10-15T09:00:00.000Z');
    expect(r.byId.A.stations[1].stale).toBe(true);
    expect(r.byId.A.asOf).toBe('2026-10-15T09:00:00.000Z');
    expect(r.byId.A.stale).toBe(true);
  });

  it('stale FAA feed marks stations stale', () => {
    const r = routeImpacts([B], faaOf({ LAX: { level: 'caution' } }, { stale: true }), noWx);
    expect(r.byId.B.stale).toBe(true);
  });

  it('noForecast, noData and missing results contribute nothing', () => {
    const r = routeImpacts(
      [A],
      noFaa,
      { results: { [keyDfwConn]: wx(keyDfwConn, { state: 'noForecast', level: 'none', asOf: null }), [keyLaxA]: wx(keyLaxA, { state: 'noData', asOf: null }) }, stale: false },
    );
    expect(r.byId.A.stations.map((s) => [s.level, s.noForecast])).toEqual([['none', true], ['none', false]]);
    expect(r.byId.A.level).toBe('none');
    expect(r.byId.A.asOf).toBeNull();
  });

  it('noForecast station still shows an FAA impact', () => {
    const r = routeImpacts([A], faaOf({ DFW: { level: 'likelyDelays', text: 'stop' } }), {
      results: { [keyDfwConn]: wx(keyDfwConn, { state: 'noForecast', asOf: null }) }, stale: false,
    });
    expect(r.byId.A.stations[0]).toMatchObject({ level: 'likelyDelays', noForecast: true });
  });

  it('airports are deduped across routes and keep the worst level', () => {
    const r = routeImpacts(
      [A, B, C],
      faaOf({ DFW: { level: 'caution' }, LAX: { level: 'caution' } }),
      { results: { [keyLaxB]: wx(keyLaxB, { level: 'likelyDelays', reasons: ['Thunderstorms'] }), [keyDfwC]: wx(keyDfwC) }, stale: false },
    );
    expect(r.airports).toEqual([{ code: 'DFW', level: 'caution' }, { code: 'LAX', level: 'likelyDelays' }]);
    expect(r.byId.A.stations[1].level).toBe('caution'); // LAX in A's window has only the FAA caution
    expect(r.byId.B.level).toBe('likelyDelays');
  });
});

describe('sampleRouteImpacts', () => {
  it('is deterministic, marks some stations and uses a ~12 min old asOf', () => {
    const its = [A, B, C];
    const now = Date.parse('2026-10-15T12:00:00Z');
    const a = sampleRouteImpacts(its, now);
    expect(sampleRouteImpacts(its, now)).toEqual(a);
    expect(a.airports.length).toBeGreaterThan(0);
    const s = a.byId.A.stations.find((x) => x.level !== 'none');
    if (s) expect(s.asOf).toBe('2026-10-15T11:48:00.000Z');
  });
  it('never returns an empty preview when there are stations', () => {
    expect(sampleRouteImpacts([B]).airports.length).toBe(1);
  });
});

describe('useRouteImpacts', () => {
  const config = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
  const mounted: ReactTestRenderer[] = [];
  afterEach(async () => {
    while (mounted.length) await act(async () => mounted.pop()!.unmount());
  });
  const json = (body: unknown) =>
    jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(async () => ({ ok: true, status: 200, json: async () => body }));
  async function render(its: Itinerary[], opts: Parameters<typeof useRouteImpacts>[1]) {
    const seen: RouteImpactsResult[] = [];
    function Comp() {
      seen.push(useRouteImpacts(its, opts));
      return null;
    }
    await act(async () => {
      mounted.push(create(<Comp />));
    });
    return seen;
  }

  it('not configured -> off, no fetches', async () => {
    const f = json({});
    const seen = await render([A], { config: null, faaFetcher: f, weatherFetcher: f });
    expect(seen[seen.length - 1]).toEqual({ state: 'off', byId: {}, airports: [] });
    expect(f).not.toHaveBeenCalled();
  });

  it('makes one batched call per source and returns impacts', async () => {
    const faaF = json({
      fetchedAt: 'x', asOf: '2026-10-15T11:00:00.000Z', stale: false,
      airports: { DFW: { code: 'DFW', level: 'likelyDelays', events: [{ type: 'groundStop', reason: 'x' }] } },
    });
    const wxF = json({
      fetchedAt: 'x', stale: false,
      results: [wx(keyLaxA, { level: 'caution', reasons: ['Low clouds'] })],
    });
    const seen = await render([A, B], { config, faaFetcher: faaF, weatherFetcher: wxF, refreshMs: 0 });
    expect(faaF).toHaveBeenCalledTimes(1);
    expect(wxF).toHaveBeenCalledTimes(1);
    expect(faaF.mock.calls[0][0]).toContain('airports=DFW%2CLAX');
    const last = seen[seen.length - 1];
    expect(last.state).toBe('ready');
    expect(last.byId.A.level).toBe('likelyDelays');
    expect(last.airports).toEqual([{ code: 'DFW', level: 'likelyDelays' }, { code: 'LAX', level: 'caution' }]);
    expect(seen[0].state).toBe('loading');
  });

  it('both fetches failing -> error', async () => {
    const bad = jest.fn<ReturnType<Fetcher>, Parameters<Fetcher>>(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const seen = await render([A], { config, faaFetcher: bad, weatherFetcher: bad, refreshMs: 0 });
    expect(seen[seen.length - 1].state).toBe('error');
  });

  it('unmount stops polling (no calls after unmount)', async () => {
    jest.useFakeTimers();
    const f = json({ fetchedAt: 'x', asOf: null, stale: false, airports: {}, results: [] });
    await render([A], { config, faaFetcher: f, weatherFetcher: f, refreshMs: 1000 });
    const n = f.mock.calls.length;
    await act(async () => mounted.pop()!.unmount());
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(f.mock.calls.length).toBe(n);
    jest.useRealTimers();
  });
});
