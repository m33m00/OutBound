import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAirportWeather, type UseAirportWeatherResult } from '../useAirportWeather';
import { fetchAirportWeather, normalizeWeatherRequests, weatherKey } from '../airportWeather';
import type { Fetcher } from '../airportStatus';
import type { StationWeather } from '../airportWeather';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
const req = { station: 'ord', fromMs: 1000, toMs: 2000 };
const result: StationWeather = {
  key: 'ORD:1000:2000',
  station: 'ORD',
  icao: 'KORD',
  windowStart: 1000,
  windowEnd: 2000,
  state: 'ok',
  level: 'caution',
  reasons: ['Low clouds'],
  observedAt: null,
  issuedAt: '2026-10-14T05:30:00.000Z',
  asOf: '2026-10-14T05:30:00.000Z',
  raw: null,
  stale: false,
};
const body = { fetchedAt: '2026-10-14T06:45:00.000Z', stale: true, results: [result] };
const okFetcher = (): jest.MockedFunction<Fetcher> =>
  jest.fn(async (_u: string, _i?: { headers?: Record<string, string> }) => ({ ok: true, status: 200, json: async () => body }));

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  while (mounted.length) {
    const r = mounted.pop()!;
    await act(async () => r.unmount());
  }
  jest.useRealTimers();
});

async function render(requests: (typeof req)[], opts: Parameters<typeof useAirportWeather>[1]) {
  let latest!: UseAirportWeatherResult;
  function C() {
    latest = useAirportWeather(requests, opts);
    return null;
  }
  await act(async () => {
    mounted.push(create(<C />));
  });
  return () => latest;
}

describe('fetchAirportWeather', () => {
  it('builds the URL from normalized requests and sends the anon key', async () => {
    const f = okFetcher();
    await fetchAirportWeather([req, { ...req }, { station: 'JFK', fromMs: 5, toMs: 6 }], config, f);
    expect(f.mock.calls[0][0]).toBe(
      'https://x.supabase.co/functions/v1/live-weather?stations=' + encodeURIComponent('JFK:5:6,ORD:1000:2000'),
    );
    expect(f.mock.calls[0][1]?.headers?.apikey).toBe('anon');
  });
  it('throws on non-OK', async () => {
    const f: Fetcher = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchAirportWeather([req], config, f)).rejects.toThrow('429');
  });
  it('normalizes and keys requests', () => {
    expect(normalizeWeatherRequests([req, req])).toEqual([{ station: 'ORD', fromMs: 1000, toMs: 2000 }]);
    expect(weatherKey({ station: 'ORD', fromMs: 1, toMs: 2 })).toBe('ORD:1:2');
  });
});

describe('useAirportWeather', () => {
  it('loads results by key via the injected fetcher', async () => {
    const get = await render([req], { fetcher: okFetcher(), config, refreshMs: 0 });
    expect(get().results['ORD:1000:2000'].level).toBe('caution');
    expect(get().stale).toBe(true);
    expect(get().loading).toBe(false);
    expect(get().error).toBeNull();
  });
  it('reports not_configured without calling anything', async () => {
    const f = okFetcher();
    const get = await render([req], { fetcher: f, config: null });
    expect(get().error).toBe('not_configured');
    expect(f).not.toHaveBeenCalled();
  });
  it('reports fetch_failed', async () => {
    const f: Fetcher = async () => {
      throw new Error('net');
    };
    const get = await render([req], { fetcher: f, config, refreshMs: 0 });
    expect(get().error).toBe('fetch_failed');
  });
  it('does nothing for an empty list', async () => {
    const f = okFetcher();
    const get = await render([], { fetcher: f, config });
    expect(f).not.toHaveBeenCalled();
    expect(get().error).toBeNull();
  });
  it('does not poll on invalid refreshMs, clamps huge ones', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(globalThis, 'setInterval');
    await render([req], { fetcher: okFetcher(), config, refreshMs: NaN });
    expect(spy).not.toHaveBeenCalled();
    await render([{ ...req, station: 'DEN' }], { fetcher: okFetcher(), config, refreshMs: 1e12 });
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 2_147_483_647);
    spy.mockRestore();
  });
});
