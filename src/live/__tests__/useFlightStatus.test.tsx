import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFlightStatus, clearFlightStatusMemo, type UseFlightStatusResult } from '../useFlightStatus';
import { fetchFlightStatus, flightLookupKey, refreshAllowed, CLIENT_COOLDOWN_MS, type FlightLookup, type FlightStatusResponse } from '../flightStatus';
import type { Fetcher } from '../airportStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
const lookup: FlightLookup = { airline: 'aa', flightNumber: '100', date: '2026-10-22', from: 'ORD', departUtc: 1761141600000 };
const body: FlightStatusResponse = {
  flightNumber: 'AA100', date: '2026-10-22', state: 'ok', stale: false, paused: false,
  fetchedAt: '2026-10-21T12:00:00.000Z', status: null,
};
const okFetcher = (b: unknown = body): jest.MockedFunction<Fetcher> =>
  jest.fn(async (_u: string, _i?: { headers?: Record<string, string> }) => ({ ok: true, status: 200, json: async () => b }));

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  while (mounted.length) await act(async () => mounted.pop()!.unmount());
  clearFlightStatusMemo();
});

async function render(l: FlightLookup | null, opts: Parameters<typeof useFlightStatus>[1]) {
  let latest!: UseFlightStatusResult;
  function C() {
    latest = useFlightStatus(l, opts);
    return null;
  }
  await act(async () => void mounted.push(create(<C />)));
  return () => latest;
}

describe('fetchFlightStatus', () => {
  it('builds the URL (flight, date, from, dep) and sends the anon key', async () => {
    const f = okFetcher();
    await fetchFlightStatus(lookup, config, f);
    expect(f.mock.calls[0][0]).toBe(
      'https://x.supabase.co/functions/v1/live-flight-status?flight=AA100&date=2026-10-22&from=ORD&dep=1761141600000',
    );
    expect(f.mock.calls[0][1]?.headers?.apikey).toBe('anon');
  });
  it('throws on a non-OK response', async () => {
    const f: Fetcher = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchFlightStatus(lookup, config, f)).rejects.toThrow('429');
  });
});

describe('cooldown helpers', () => {
  it('refreshAllowed honours the cooldown', () => {
    expect(refreshAllowed(null, 1000)).toBe(true);
    expect(refreshAllowed(1000, 1000 + CLIENT_COOLDOWN_MS - 1)).toBe(false);
    expect(refreshAllowed(1000, 1000 + CLIENT_COOLDOWN_MS)).toBe(true);
  });
  it('keys ignore case and spaces', () => {
    expect(flightLookupKey(lookup)).toBe('AA100|2026-10-22|ORD');
  });
});

describe('useFlightStatus', () => {
  it('makes no request while nothing is open', async () => {
    const f = okFetcher();
    const get = await render(null, { fetcher: f, config });
    expect(f).not.toHaveBeenCalled();
    expect(get().response).toBeNull();
  });
  it('reports not_configured without a config', async () => {
    const get = await render(lookup, { config: null });
    expect(get().error).toBe('not_configured');
  });
  it('fetches once on open and exposes the response', async () => {
    const f = okFetcher();
    const get = await render(lookup, { fetcher: f, config });
    expect(f).toHaveBeenCalledTimes(1);
    expect(get().response).toEqual(body);
    expect(get().error).toBeNull();
  });
  it('refresh is ignored inside the cooldown and sent after it; reopening inside it asks nobody', async () => {
    let t = 1_000_000;
    const f = okFetcher();
    const get = await render(lookup, { fetcher: f, config, nowFn: () => t });
    let sent = true;
    await act(async () => { sent = get().refresh(); });
    expect(sent).toBe(false);
    t += CLIENT_COOLDOWN_MS;
    await act(async () => { sent = get().refresh(); });
    expect(sent).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);

    await act(async () => mounted.pop()!.unmount());
    t += 1000;
    const get2 = await render(lookup, { fetcher: f, config, nowFn: () => t });
    expect(f).toHaveBeenCalledTimes(2);
    expect(get2().response).toEqual(body);
  });
  it('keeps a stale/paused response as-is and surfaces fetch failures', async () => {
    const paused = { ...body, state: 'paused' as const, paused: true, stale: true };
    const get = await render(lookup, { fetcher: okFetcher(paused), config });
    expect(get().response).toMatchObject({ paused: true, stale: true });
    clearFlightStatusMemo();
    const bad: Fetcher = async () => { throw new Error('offline'); };
    const get2 = await render({ ...lookup, flightNumber: '200' }, { fetcher: bad, config });
    expect(get2().error).toBe('fetch_failed');
  });
});
