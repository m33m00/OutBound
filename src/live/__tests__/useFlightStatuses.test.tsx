import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFlightStatuses, clearFlightStatusesMemo, type UseFlightStatusesResult, type UseFlightStatusesOptions } from '../useFlightStatuses';
import { BATCH_MAX, CLIENT_COOLDOWN_MS, dedupeLookups, fetchFlightStatuses, flightLookupKey, type FlightLookup, type BatchResponse } from '../flightStatus';
import { sampleFlightStatus } from '../fixtures/sampleFlightStatuses';
import type { Fetcher } from '../airportStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
const DEP = Date.UTC(2026, 9, 22, 14);
const mkLookup = (n: number, over: Partial<FlightLookup> = {}): FlightLookup => ({
  airline: 'AA', flightNumber: String(100 + n), date: '2026-10-22', from: 'ORD', departUtc: DEP, ...over,
});
const lookups = (n: number) => Array.from({ length: n }, (_, i) => mkLookup(i));

/** Fake server: answers a batch POST positionally, status derived from the flight number. */
function batchFetcher(opts: { fail?: boolean; stale?: boolean } = {}) {
  const f = jest.fn(async (_u: string, init?: { body?: string }) => {
    if (opts.fail) return { ok: false, status: 502, json: async () => ({}) };
    const { flights } = JSON.parse(init!.body!) as { flights: { flight: string }[] };
    const res: BatchResponse = {
      asOf: '2026-10-21T12:00:00.000Z',
      results: flights.map((fl) => ({
        key: fl.flight,
        flightNumber: fl.flight,
        date: '2026-10-22',
        state: 'ok' as const,
        stale: !!opts.stale,
        paused: false,
        fetchedAt: '2026-10-21T11:56:00.000Z',
        status: {
          flightNumber: fl.flight,
          state: 'delayed' as const,
          departure: { airport: 'ORD', scheduledUtc: null, estimatedUtc: null, actualUtc: null, delayMin: 25, terminal: null, gate: null },
          arrival: { airport: 'LAX', scheduledUtc: null, estimatedUtc: null, actualUtc: null, delayMin: 20, terminal: null, gate: null },
          providerUpdatedAt: null,
        },
      })),
    };
    return { ok: true, status: 200, json: async () => res };
  });
  return f as unknown as jest.MockedFunction<Fetcher> & jest.Mock;
}

describe('fetchFlightStatuses', () => {
  it('POSTs one batch with the anon key, dedupes, and keys results by flightLookupKey', async () => {
    const f = batchFetcher();
    const out = await fetchFlightStatuses([mkLookup(0), mkLookup(1), mkLookup(0, { airline: 'aa' })], config, f);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe('https://x.supabase.co/functions/v1/live-flight-status');
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('anon');
    expect(JSON.parse(init.body).flights).toEqual([
      { flight: 'AA100', date: '2026-10-22', from: 'ORD', dep: DEP },
      { flight: 'AA101', date: '2026-10-22', from: 'ORD', dep: DEP },
    ]);
    expect(Object.keys(out)).toEqual([flightLookupKey(mkLookup(0)), flightLookupKey(mkLookup(1))]);
    expect(out[flightLookupKey(mkLookup(0))]).toMatchObject({ state: 'delayed', delayMin: 25, asOf: '2026-10-21T11:56:00.000Z', stale: false });
  });

  it('splits more than BATCH_MAX lookups into several requests', async () => {
    const f = batchFetcher();
    const out = await fetchFlightStatuses(lookups(BATCH_MAX + 5), config, f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(Object.keys(out)).toHaveLength(BATCH_MAX + 5);
  });

  it('omits flights the server has no status for, and throws on a non-OK reply', async () => {
    const f = jest.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ asOf: 'x', results: [{ key: 'k', state: 'not_found', stale: false, paused: false, fetchedAt: null, status: null }] }),
    }));
    expect(await fetchFlightStatuses([mkLookup(0)], config, f as unknown as Fetcher)).toEqual({});
    await expect(fetchFlightStatuses([mkLookup(0)], config, batchFetcher({ fail: true }))).rejects.toThrow('502');
  });

  it('dedupeLookups keeps first, in order', () => {
    expect(dedupeLookups([mkLookup(1), mkLookup(0), mkLookup(1)]).map((d) => d.key)).toEqual([flightLookupKey(mkLookup(1)), flightLookupKey(mkLookup(0))]);
  });
});

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  jest.useRealTimers();
  while (mounted.length) await act(async () => mounted.pop()!.unmount());
  clearFlightStatusesMemo();
});

async function render(l: readonly FlightLookup[], opts: UseFlightStatusesOptions) {
  let latest!: UseFlightStatusesResult;
  function C({ list, o }: { list: readonly FlightLookup[]; o: UseFlightStatusesOptions }) {
    latest = useFlightStatuses(list, o);
    return null;
  }
  let r!: ReactTestRenderer;
  await act(async () => void mounted.push((r = create(<C list={l} o={opts} />))));
  return {
    get: () => latest,
    rerender: (list: readonly FlightLookup[], o: UseFlightStatusesOptions = opts) => act(async () => r.update(<C list={list} o={o} />)),
  };
}

describe('useFlightStatuses', () => {
  it('no config: deterministic sample statuses, sample true, no network', async () => {
    const f = batchFetcher();
    const h = await render(lookups(30), { config: null, fetcher: f, now: () => 1_000 });
    expect(h.get().sample).toBe(true);
    expect(h.get().state).toBe('ready');
    expect(Object.keys(h.get().byKey)).toHaveLength(30);
    expect(f).not.toHaveBeenCalled();
    const states = new Set(Object.values(h.get().byKey).map((s) => s.state));
    expect(states.size).toBeGreaterThanOrEqual(4);
    // same ids -> same statuses
    const h2 = await render(lookups(30), { config: null, now: () => 5_000 });
    for (const k of Object.keys(h.get().byKey)) expect(h2.get().byKey[k].state).toBe(h.get().byKey[k].state);
    expect(sampleFlightStatus(mkLookup(3), 0).state).toBe(sampleFlightStatus(mkLookup(3), 99).state);
  });

  it('sample fixtures cover on-time, delayed 25m, departed, canceled, arrived, diverted', () => {
    const seen: Record<string, number | null> = {};
    for (let i = 0; i < 400; i++) {
      const s = sampleFlightStatus(mkLookup(i), 0);
      seen[s.state] = s.delayMin;
    }
    expect(Object.keys(seen).sort()).toEqual(['arrived', 'canceled', 'delayed', 'departed', 'diverted', 'scheduled']);
    expect(seen.delayed).toBe(25);
  });

  it('empty list: off, nothing fetched', async () => {
    const f = batchFetcher();
    const h = await render([], { config, fetcher: f });
    expect(h.get()).toMatchObject({ byKey: {}, state: 'off', sample: false });
    expect(f).not.toHaveBeenCalled();
  });

  it('configured: loading then ready with statuses by key, one request for the whole list', async () => {
    const f = batchFetcher();
    const h = await render(lookups(12), { config, fetcher: f, refreshMs: 0 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(h.get()).toMatchObject({ state: 'ready', sample: false });
    expect(h.get().byKey[flightLookupKey(mkLookup(4))].delayMin).toBe(25);
  });

  it('does not refetch on re-render with the same flights, and not on remount inside the cooldown', async () => {
    const f = batchFetcher();
    const h = await render(lookups(5), { config, fetcher: f, refreshMs: 0, now: () => 10_000 });
    await h.rerender(lookups(5));
    expect(f).toHaveBeenCalledTimes(1);
    await render(lookups(5), { config, fetcher: f, refreshMs: 0, now: () => 10_000 + CLIENT_COOLDOWN_MS - 1 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('after the cooldown, asks again; a changed list asks only for the new flights', async () => {
    const f = batchFetcher();
    let t = 10_000;
    const h = await render(lookups(3), { config, fetcher: f, refreshMs: 0, now: () => t });
    await h.rerender(lookups(5));
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse((f.mock.calls[1] as [string, { body: string }])[1].body).flights).toHaveLength(2);
    t += CLIENT_COOLDOWN_MS;
    await h.rerender(lookups(5), { config, fetcher: f, refreshMs: 0, now: () => t });
    // options object changed but values same -> effect deps (config, fetcher, refreshMs) unchanged: no new request
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('polls on refreshMs but never faster than the cooldown', async () => {
    jest.useFakeTimers();
    const f = batchFetcher();
    let t = 0;
    await render(lookups(2), { config, fetcher: f, refreshMs: 1000, now: () => t });
    expect(f).toHaveBeenCalledTimes(1);
    t += 1000;
    await act(async () => void jest.advanceTimersByTime(1000));
    expect(f).toHaveBeenCalledTimes(1); // timer clamped up to the cooldown
    t += CLIENT_COOLDOWN_MS;
    await act(async () => void jest.advanceTimersByTime(CLIENT_COOLDOWN_MS));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('first-load failure is error; a later failure keeps old data flagged stale', async () => {
    const bad = await render(lookups(2), { config, fetcher: batchFetcher({ fail: true }), refreshMs: 0 });
    expect(bad.get()).toMatchObject({ state: 'error', byKey: {} });

    jest.useFakeTimers();
    clearFlightStatusesMemo();
    let ok = true;
    const f = batchFetcher();
    const flaky = jest.fn(async (u: string, i?: { body?: string }) => (ok ? (f as unknown as Fetcher)(u, i) : { ok: false, status: 502, json: async () => ({}) }));
    let t = 0;
    const h = await render(lookups(2), { config, fetcher: flaky as unknown as Fetcher, refreshMs: CLIENT_COOLDOWN_MS, now: () => t });
    expect(Object.values(h.get().byKey).every((s) => !s.stale)).toBe(true);
    ok = false;
    t += CLIENT_COOLDOWN_MS;
    await act(async () => void jest.advanceTimersByTime(CLIENT_COOLDOWN_MS));
    expect(h.get().state).toBe('ready');
    expect(Object.values(h.get().byKey).every((s) => s.stale)).toBe(true);
  });

  it('serve-stale flag from the server passes through', async () => {
    const h = await render(lookups(1), { config, fetcher: batchFetcher({ stale: true }), refreshMs: 0 });
    expect(Object.values(h.get().byKey)[0].stale).toBe(true);
  });
});
