import {
  allowLookups,
  cacheExpiry,
  createUsageTracker,
  mapState,
  monthKey,
  newFlightCache,
  parseBatchBody,
  parseFlightRequest,
  parseFlightStatus,
  requestKey,
  resolveFlightBatch,
  resolveFlightStatus,
  type FlightRequest,
  type UsageStore,
} from '../../../supabase/functions/_shared/flightStatus';
import { FLIGHT_STATUS_CONFIG as CFG } from '../../../supabase/functions/_shared/flightStatusConfig';
import * as F from '../fixtures/flight-status-samples';

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 21, 12);
/** 2 h before the sample flights' 14:00Z departure on 10/22. */
const T2 = Date.UTC(2026, 9, 22, 12);
const req = (o: Partial<FlightRequest> = {}): FlightRequest => ({ flightNumber: 'AA100', date: '2026-10-22', from: null, departMs: null, ...o });
const q = (s: string) => new URLSearchParams(s);

describe('parseFlightRequest', () => {
  it('normalises and accepts a valid request', () => {
    expect(parseFlightRequest(q('flight=aa%20100&date=2026-10-22&from=ord&dep=1761141600000'), NOW)).toEqual({
      flightNumber: 'AA100', date: '2026-10-22', from: 'ORD', departMs: 1761141600000,
    });
  });
  it('rejects bad numbers, impossible dates and dates outside the window (no bulk or far lookups)', () => {
    for (const s of ['date=2026-10-22', 'flight=A&date=2026-10-22', 'flight=AA100&date=2026-13-40', 'flight=AA100&date=2026-02-31', 'flight=AA100&date=2027-10-22', 'flight=AA100&date=2026-01-01']) {
      expect(parseFlightRequest(q(s), NOW)).toBeNull();
    }
  });
  it('ignores a bad from/dep instead of failing', () => {
    expect(parseFlightRequest(q('flight=AA100&date=2026-10-22&from=ORDX&dep=abc'), NOW)).toMatchObject({ from: null, departMs: null });
  });
});

describe('parseFlightStatus', () => {
  it('on time: scheduled, gates and terminals, zero delay', () => {
    const s = parseFlightStatus(F.ADB_ON_TIME, req())!;
    expect(s.state).toBe('scheduled');
    expect(s.departure).toMatchObject({ airport: 'ORD', scheduledUtc: '2026-10-22T14:00:00.000Z', terminal: '3', gate: 'K12', actualUtc: null, estimatedUtc: null, delayMin: null });
    expect(s.arrival).toMatchObject({ airport: 'LAX', terminal: '4', gate: '41B' });
    expect(s.providerUpdatedAt).toBe('2026-10-22T10:00:00.000Z');
  });
  it('delayed: revised time becomes the estimate and delay minutes', () => {
    const s = parseFlightStatus(F.ADB_DELAYED, req({ flightNumber: 'DL2210' }))!;
    expect(s.state).toBe('delayed');
    expect(s.departure.delayMin).toBe(50);
    expect(s.departure.estimatedUtc).toBe('2026-10-22T15:50:00.000Z');
    expect(s.arrival.gate).toBeNull();
  });
  it('departed: runway time is the actual departure, predicted time the arrival estimate', () => {
    const s = parseFlightStatus(F.ADB_DEPARTED, req())!;
    expect(s.state).toBe('departed');
    expect(s.departure).toMatchObject({ actualUtc: '2026-10-22T12:12:00.000Z', delayMin: 12 });
    expect(s.arrival).toMatchObject({ actualUtc: null, estimatedUtc: '2026-10-22T14:42:00.000Z', delayMin: 12 });
  });
  it('arrived: both sides actual, early arrival is negative', () => {
    const s = parseFlightStatus(F.ADB_ARRIVED, req())!;
    expect(s.state).toBe('arrived');
    expect(s.arrival).toMatchObject({ actualUtc: '2026-10-22T17:26:00.000Z', delayMin: -4 });
  });
  it('canceled and diverted', () => {
    expect(parseFlightStatus(F.ADB_CANCELED, req())!.state).toBe('canceled');
    expect(parseFlightStatus(F.ADB_DIVERTED, req())!.state).toBe('diverted');
  });
  it('picks the leg by departure airport; no match = null', () => {
    expect(parseFlightStatus(F.ADB_TWO_LEGS, req({ from: 'ORD' }))!.departure.gate).toBe('2');
    expect(parseFlightStatus(F.ADB_TWO_LEGS, req({ from: 'LAX' }))).toBeNull();
  });
  it('a quiet but 20 min late flight is delayed (threshold from config)', () => {
    expect(parseFlightStatus(F.ADB_QUIET_LATE, req())!.state).toBe('delayed');
    expect(mapState('Expected', CFG.delayedAtOrAboveMin - 1, null)).toBe('scheduled');
    expect(mapState('Expected', CFG.delayedAtOrAboveMin, null)).toBe('delayed');
  });
  it('garbage gives null, never throws', () => {
    for (const b of [null, undefined, 'x', 3, [], [1], {}]) expect(() => parseFlightStatus(b, req())).not.toThrow();
    expect(parseFlightStatus([], req())).toBeNull();
  });
});

describe('cacheExpiry (TTL by time to departure)', () => {
  const ttl = (hoursOut: number | null, state = null as never) =>
    cacheExpiry(NOW, hoursOut == null ? null : NOW + hoursOut * H, state) - NOW;
  it('uses the configured tiers', () => {
    expect(ttl(72)).toBe(CFG.ttlFarMs);
    expect(ttl(47.9)).toBe(CFG.ttlTiers[2].ttlMs);
    expect(ttl(12)).toBe(CFG.ttlTiers[1].ttlMs);
    expect(ttl(2)).toBe(CFG.ttlTiers[0].ttlMs);
    expect(ttl(null)).toBe(CFG.ttlFarMs);
  });
  it('never outlives the next tier boundary (49 h out is rechecked at 48 h)', () => {
    expect(ttl(49)).toBe(1 * H);
    expect(ttl(25)).toBe(1 * H);
    expect(ttl(3.25)).toBe(0.25 * H);
  });
  it('past departure: in the air rechecks fast, finished flights slowly', () => {
    expect(cacheExpiry(NOW, NOW - H, 'departed') - NOW).toBe(CFG.ttlTiers[0].ttlMs);
    expect(cacheExpiry(NOW, NOW - H, 'arrived') - NOW).toBe(CFG.ttlPastMs);
    expect(cacheExpiry(NOW, NOW - H, 'canceled') - NOW).toBe(CFG.ttlPastMs);
  });
});

describe('monthKey', () => {
  it('is UTC YYYY-MM', () => {
    expect(monthKey(Date.UTC(2026, 9, 31, 23, 59))).toBe('2026-10');
    expect(monthKey(Date.UTC(2026, 10, 1))).toBe('2026-11');
  });
});

describe('usage tracker (no cap, Q-049)', () => {
  it('writes one row per record and never warns or refuses, however high the count', async () => {
    const rows: unknown[] = [];
    const store: UsageStore = { record: async (r) => void rows.push(r) };
    const log = jest.fn();
    const t = createUsageTracker(store, log);
    for (let i = 0; i < 5000; i++) await t.record(NOW);
    expect(rows).toHaveLength(5000);
    expect(rows[0]).toEqual({ provider: CFG.usage.provider, endpoint: CFG.usage.endpoint, units: CFG.usage.unitsPerCall, month: '2026-10' });
    expect(log.mock.calls.filter((c) => /WARNING|cap|paused/i.test(String(c[0])))).toHaveLength(0);
    expect(t.unitsThisMonth(NOW)).toBe(5000 * CFG.usage.unitsPerCall);
  });
  it('a missing table does not break counting (falls back to memory, logs once)', async () => {
    const store: UsageStore = { record: async () => { throw new Error('api_usage write 404'); } };
    const log = jest.fn();
    const t = createUsageTracker(store, log);
    await t.record(NOW);
    await t.record(NOW);
    expect(t.unitsThisMonth(NOW)).toBe(2 * CFG.usage.unitsPerCall);
    expect(log.mock.calls.filter((c) => String(c[0]).includes('unavailable'))).toHaveLength(1);
  });
  it('works with no store at all', async () => {
    const t = createUsageTracker(null);
    await t.record(NOW);
    expect(t.unitsThisMonth(NOW)).toBe(CFG.usage.unitsPerCall);
  });
  it('config has no cap or alert values', () => {
    expect(Object.keys(CFG.usage)).not.toEqual(expect.arrayContaining(['monthlyCapUsd']));
    expect(Object.keys(CFG.usage)).not.toEqual(expect.arrayContaining(['alertAtUsd']));
  });
});

describe('resolveFlightStatus', () => {
  const setup = (upstream: jest.Mock, store: UsageStore | null = null) => {
    const usage = createUsageTracker(store);
    return { cache: newFlightCache(), usage, fetchUpstream: upstream };
  };
  const ok = (body: unknown = F.ADB_ON_TIME) => jest.fn(async () => ({ status: 200, body }));

  it('first call goes upstream and logs units; a second inside the TTL is served from cache', async () => {
    const up = ok();
    const deps = setup(up);
    const a = await resolveFlightStatus(deps, req({ departMs: NOW + 30 * H }), NOW);
    expect(a).toMatchObject({ state: 'ok', stale: false, paused: false, fetchedAt: new Date(NOW).toISOString() });
    expect(a.status?.state).toBe('scheduled');
    await resolveFlightStatus(deps, req({ departMs: NOW + 30 * H }), NOW + 10 * 60_000);
    expect(up).toHaveBeenCalledTimes(1);
    expect(deps.usage.unitsThisMonth(NOW)).toBe(CFG.usage.unitsPerCall);
  });

  it('refetches after the TTL', async () => {
    const up = ok();
    const deps = setup(up);
    await resolveFlightStatus(deps, req(), T2);
    await resolveFlightStatus(deps, req(), T2 + CFG.ttlTiers[0].ttlMs - 1);
    expect(up).toHaveBeenCalledTimes(1);
    await resolveFlightStatus(deps, req(), T2 + CFG.ttlTiers[0].ttlMs + 1);
    expect(up).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent requests for the same flight', async () => {
    const up = ok();
    const deps = setup(up);
    await Promise.all([resolveFlightStatus(deps, req(), NOW), resolveFlightStatus(deps, req(), NOW)]);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('upstream error with a cached value serves it flagged stale; backs off before asking again', async () => {
    const up = jest.fn().mockResolvedValueOnce({ status: 200, body: F.ADB_ON_TIME }).mockRejectedValue(new Error('boom'));
    const deps = setup(up);
    const r = req();
    await resolveFlightStatus(deps, r, T2);
    const later = T2 + CFG.ttlTiers[0].ttlMs + 1;
    const s = await resolveFlightStatus(deps, r, later);
    expect(s).toMatchObject({ state: 'ok', stale: true, fetchedAt: new Date(T2).toISOString() });
    expect(s.status?.departure.gate).toBe('K12');
    await resolveFlightStatus(deps, r, later + 1000);
    expect(up).toHaveBeenCalledTimes(2); // second failure skipped inside the backoff
    await resolveFlightStatus(deps, r, later + CFG.failureBackoffMs + 1);
    expect(up).toHaveBeenCalledTimes(3);
  });

  it('upstream non-200 (e.g. 429) is not charged and, with no cache, is unavailable', async () => {
    const deps = setup(jest.fn(async () => ({ status: 429, body: null })));
    const s = await resolveFlightStatus(deps, req(), NOW);
    expect(s).toMatchObject({ state: 'unavailable', status: null });
    expect(deps.usage.unitsThisMonth(NOW)).toBe(0);
  });

  it('404 is not_found and is cached', async () => {
    const up = jest.fn(async () => ({ status: 404, body: null }));
    const deps = setup(up);
    expect((await resolveFlightStatus(deps, req(), NOW)).state).toBe('not_found');
    expect((await resolveFlightStatus(deps, req(), NOW + 1000)).state).toBe('not_found');
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('no cap: any amount of prior usage never pauses or blocks a call', async () => {
    const up = ok();
    const deps = setup(up);
    for (let i = 0; i < 20_000; i++) await deps.usage.record(NOW);
    const r = await resolveFlightStatus(deps, req(), NOW);
    expect(r).toMatchObject({ state: 'ok', paused: false, stale: false });
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('a broken usage table never blocks status', async () => {
    const broken: UsageStore = { record: async () => { throw new Error('no table'); } };
    const s = await resolveFlightStatus(setup(ok(), broken), req(), NOW);
    expect(s.state).toBe('ok');
  });
});

describe('batch', () => {
  const ok = (body: unknown = F.ADB_ON_TIME) => jest.fn(async () => ({ status: 200, body }));
  const mk = (up: jest.Mock, rows: unknown[] = []) => ({
    cache: newFlightCache(),
    usage: createUsageTracker({ record: async (r) => void rows.push(r) }),
    fetchUpstream: up,
  });
  const body = (n: number, extra: Record<string, unknown> = {}) => ({
    flights: Array.from({ length: n }, (_, i) => ({ flight: `AA${100 + i}`, date: '2026-10-22', from: 'ORD', dep: T2 + H, ...extra })),
  });

  it('parseBatchBody: 1..batchMax items, bad items become null, bad shapes are rejected', () => {
    expect(parseBatchBody(body(3), NOW)?.items.every(Boolean)).toBe(true);
    expect(parseBatchBody(body(CFG.batchMax), NOW)?.items).toHaveLength(CFG.batchMax);
    expect(parseBatchBody(body(CFG.batchMax + 1), NOW)).toBeNull();
    expect(parseBatchBody({ flights: [] }, NOW)).toBeNull();
    expect(parseBatchBody({}, NOW)).toBeNull();
    expect(parseBatchBody(null, NOW)).toBeNull();
    expect(parseBatchBody({ flights: [{ flight: 'nope', date: '2026-10-22' }, 7] }, NOW)?.items).toEqual([null, null]);
  });

  it('a full list is one answer per input position, in order, one upstream call + one usage row per flight', async () => {
    const rows: unknown[] = [];
    const up = ok();
    const parsed = parseBatchBody(body(CFG.batchMax), NOW)!;
    const out = await resolveFlightBatch(mk(up, rows), parsed.items, NOW);
    expect(out).toHaveLength(CFG.batchMax);
    expect(out.map((r) => r.key)).toEqual(parsed.items.map((r) => requestKey(r!)));
    expect(up).toHaveBeenCalledTimes(CFG.batchMax);
    expect(rows).toHaveLength(CFG.batchMax);
  });

  it('dedupes by flight + date + origin; a repeat batch inside the TTL costs nothing', async () => {
    const rows: unknown[] = [];
    const up = ok();
    const deps = mk(up, rows);
    const dup = parseBatchBody({ flights: [...body(2).flights, ...body(2).flights, { ...body(1).flights[0], from: 'JFK' }] }, NOW)!;
    const first = await resolveFlightBatch(deps, dup.items, NOW);
    expect(first).toHaveLength(5);
    expect(first[0].key).toBe(first[2].key);
    expect(up).toHaveBeenCalledTimes(3); // AA100 ORD, AA101 ORD, AA100 JFK
    await resolveFlightBatch(deps, dup.items, NOW + 60_000);
    expect(up).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(3);
  });

  it('TTL tiers apply per flight inside a batch (refetch only the expired tier)', async () => {
    const far = [{ ...F.ADB_ON_TIME[0], departure: { ...F.ADB_ON_TIME[0].departure, scheduledTime: { utc: '2026-10-26 14:00Z' } } }];
    const up = jest.fn(async (r: { flightNumber: string }) => ({ status: 200, body: r.flightNumber === 'AA2' ? far : F.ADB_ON_TIME }));
    const deps = mk(up as unknown as jest.Mock);
    const items = parseBatchBody({ flights: [{ flight: 'AA1', date: '2026-10-22' }, { flight: 'AA2', date: '2026-10-22' }] }, NOW)!.items;
    await resolveFlightBatch(deps, items, T2); // AA1 departs in 2h (15m tier), AA2 in days (hours tier)
    expect(up).toHaveBeenCalledTimes(2);
    await resolveFlightBatch(deps, items, T2 + CFG.ttlTiers[0].ttlMs + 1); // only AA1 expired
    expect(up).toHaveBeenCalledTimes(3);
  });

  it('one failing flight does not fail the batch; cached ones come back stale', async () => {
    const up = jest.fn(async (r: { flightNumber: string }) => {
      if (r.flightNumber === 'AA101') throw new Error('boom');
      return { status: 200, body: F.ADB_ON_TIME };
    });
    const out = await resolveFlightBatch(mk(up as unknown as jest.Mock), parseBatchBody(body(2), NOW)!.items, NOW);
    expect(out[0]).toMatchObject({ state: 'ok', stale: false });
    expect(out[1]).toMatchObject({ state: 'unavailable', status: null });
  });

  it('invalid items come back as state invalid; upstream concurrency is bounded', async () => {
    let live = 0;
    let peak = 0;
    const up = jest.fn(async () => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 1));
      live--;
      return { status: 200, body: F.ADB_ON_TIME };
    });
    const items = [...parseBatchBody(body(20), NOW)!.items, null];
    const out = await resolveFlightBatch(mk(up as unknown as jest.Mock), items, NOW);
    expect(out[20]).toMatchObject({ state: 'invalid', key: '' });
    expect(peak).toBeLessThanOrEqual(CFG.batchConcurrency);
  });

  it('allowLookups: a full list fits, three fit per minute, the fourth waits; window resets', () => {
    const b = new Map<string, { windowStart: number; count: number }>();
    expect(CFG.lookupsPerMin).toBeGreaterThanOrEqual(CFG.batchMax * 3);
    for (let i = 0; i < 3; i++) expect(allowLookups(b, 'ip', NOW, CFG.batchMax, CFG.lookupsPerMin)).toBe(true);
    expect(allowLookups(b, 'ip', NOW, CFG.batchMax, CFG.lookupsPerMin)).toBe(false);
    expect(allowLookups(b, 'ip', NOW + 60_000, CFG.batchMax, CFG.lookupsPerMin)).toBe(true);
  });
});
