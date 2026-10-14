import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAirportStatus, type UseAirportStatusResult } from '../useAirportStatus';
import { fetchAirportStatus, readLiveConfig, type Fetcher } from '../airportStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
const body = {
  asOf: '2026-10-14T05:22:14.000Z',
  fetchedAt: '2026-10-14T05:25:00.000Z',
  stale: false,
  airports: { ORD: { code: 'ORD', level: 'caution', events: [] } },
};
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

async function render(codes: string[], opts: Parameters<typeof useAirportStatus>[1]) {
  let latest!: UseAirportStatusResult;
  function C() {
    latest = useAirportStatus(codes, opts);
    return null;
  }
  await act(async () => {
    mounted.push(create(<C />));
  });
  return () => latest;
}

describe('fetchAirportStatus', () => {
  it('builds the URL, sorts/dedupes codes, sends the anon key', async () => {
    const f = okFetcher();
    await fetchAirportStatus(['ord', 'JFK', 'ORD'], config, f);
    expect(f.mock.calls[0][0]).toBe('https://x.supabase.co/functions/v1/live-faa-status?airports=JFK%2CORD');
    expect(f.mock.calls[0][1]?.headers?.apikey).toBe('anon');
  });
  it('throws on non-OK', async () => {
    const f: Fetcher = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchAirportStatus(['ORD'], config, f)).rejects.toThrow('429');
  });
  it('readLiveConfig returns null when unset', () => {
    expect(readLiveConfig({})).toBeNull();
    expect(readLiveConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://a/', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toEqual({
      baseUrl: 'https://a',
      anonKey: 'k',
    });
  });
});

describe('useAirportStatus', () => {
  it('loads status via injected fetcher', async () => {
    const f = okFetcher();
    const get = await render(['ORD'], { fetcher: f, config, refreshMs: 0 });
    expect(get().status.ORD.level).toBe('caution');
    expect(get().asOf).toBe(body.asOf);
    expect(get().loading).toBe(false);
    expect(get().error).toBeNull();
  });
  it('reports not_configured without crashing', async () => {
    const f = okFetcher();
    const get = await render(['ORD'], { fetcher: f, config: null });
    expect(get().error).toBe('not_configured');
    expect(f).not.toHaveBeenCalled();
  });
  it('reports fetch_failed', async () => {
    const f: Fetcher = async () => {
      throw new Error('net');
    };
    const get = await render(['ORD'], { fetcher: f, config, refreshMs: 0 });
    expect(get().error).toBe('fetch_failed');
  });
  it('does nothing for an empty list', async () => {
    const f = okFetcher();
    const get = await render([], { fetcher: f, config });
    expect(f).not.toHaveBeenCalled();
    expect(get().error).toBeNull();
  });
  it('does not poll when refreshMs is invalid, and clamps huge values', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(globalThis, 'setInterval');
    await render(['ORD'], { fetcher: okFetcher(), config, refreshMs: Infinity });
    await render(['JFK'], { fetcher: okFetcher(), config, refreshMs: NaN });
    expect(spy).not.toHaveBeenCalled();
    await render(['DEN'], { fetcher: okFetcher(), config, refreshMs: 1e12 });
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 2_147_483_647);
    spy.mockRestore();
  });
});
