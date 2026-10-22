import {
  cacheExpiry,
  capState,
  createUsageTracker,
  mapState,
  monthKey,
  newFlightCache,
  parseFlightRequest,
  parseFlightStatus,
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

describe('spend cap', () => {
  const u = CFG.usage;
  const unitsFor = (usd: number) => Math.round(usd / u.unitPriceUsd);
  it('ok below the alert, alert at $24, paused when the next call would pass $30', () => {
    expect(capState(0).state).toBe('ok');
    expect(capState(unitsFor(u.alertAtUsd) - 1).state).toBe('ok');
    expect(capState(unitsFor(u.alertAtUsd)).state).toBe('alert');
    const lastOk = unitsFor(u.monthlyCapUsd) - u.unitsPerCall;
    expect(capState(lastOk).state).toBe('alert');
    expect(capState(lastOk + 1).state).toBe('paused');
    expect(capState(unitsFor(u.monthlyCapUsd) + 100).state).toBe('paused');
  });
  it('monthKey is UTC YYYY-MM', () => {
    expect(monthKey(Date.UTC(2026, 9, 31, 23, 59))).toBe('2026-10');
    expect(monthKey(Date.UTC(2026, 10, 1))).toBe('2026-11');
  });
});

describe('usage tracker', () => {
  it('records through the store and logs the alert once', async () => {
    const rows: unknown[] = [];
    const store: UsageStore = { monthUnits: async () => 0, record: async (r) => void rows.push(r) };
    const log = jest.fn();
    const t = createUsageTracker(store, log);
    await t.record(NOW, Math.round(CFG.usage.alertAtUsd / CFG.usage.unitPriceUsd));
    await t.record(NOW, 0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ provider: CFG.usage.provider, endpoint: CFG.usage.endpoint, units: CFG.usage.unitsPerCall, month: '2026-10' });
    expect(log.mock.calls.filter((c) => String(c[0]).startsWith('WARNING'))).toHaveLength(1);
  });
  it('a missing table does not break counting (falls back to memory, logs once)', async () => {
    const store: UsageStore = {
      monthUnits: async () => { throw new Error('api_usage read 404'); },
      record: async () => { throw new Error('api_usage write 404'); },
    };
    const log = jest.fn();
    const t = createUsageTracker(store, log);
    expect(await t.unitsThisMonth(NOW)).toBe(0);
    await t.record(NOW, 0);
    expect(await t.unitsThisMonth(NOW)).toBe(CFG.usage.unitsPerCall);
    expect(log.mock.calls.filter((c) => String(c[0]).includes('unavailable'))).toHaveLength(1);
  });
  it('works with no store at all', async () => {
    const t = createUsageTracker(null);
    await t.record(NOW, 0);
    expect(await t.unitsThisMonth(NOW)).toBe(CFG.usage.unitsPerCall);
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
    expect(await deps.usage.unitsThisMonth(NOW)).toBe(CFG.usage.unitsPerCall);
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
    expect(await deps.usage.unitsThisMonth(NOW)).toBe(0);
  });

  it('404 is not_found and is cached', async () => {
    const up = jest.fn(async () => ({ status: 404, body: null }));
    const deps = setup(up);
    expect((await resolveFlightStatus(deps, req(), NOW)).state).toBe('not_found');
    expect((await resolveFlightStatus(deps, req(), NOW + 1000)).state).toBe('not_found');
    expect(up).toHaveBeenCalledTimes(1);
  });

  it('at the cap: no upstream call; cached value comes back flagged stale + paused, or nothing', async () => {
    const full: UsageStore = { monthUnits: async () => Math.round(CFG.usage.monthlyCapUsd / CFG.usage.unitPriceUsd), record: async () => {} };
    const up = ok();
    const deps = setup(up, full);
    const none = await resolveFlightStatus(deps, req(), NOW);
    expect(none).toMatchObject({ state: 'paused', paused: true, status: null });
    expect(up).not.toHaveBeenCalled();

    // seed a cache entry from a different, un-capped tracker, then expire it
    const seeded = { ...setup(ok()), usage: deps.usage };
    seeded.cache.entries.set('AA100|2026-10-22|', { status: parseFlightStatus(F.ADB_ON_TIME, req()), fetchedAtMs: NOW - 10 * H, expiresMs: NOW - 1 });
    const s = await resolveFlightStatus(seeded, req(), NOW);
    expect(s).toMatchObject({ state: 'paused', paused: true, stale: true });
    expect(s.status?.flightNumber).toBe('AA100');
    expect(s.fetchedAt).toBe(new Date(NOW - 10 * H).toISOString());
  });

  it('a broken usage table never blocks status', async () => {
    const broken: UsageStore = { monthUnits: async () => { throw new Error('no table'); }, record: async () => { throw new Error('no table'); } };
    const s = await resolveFlightStatus(setup(ok(), broken), req(), NOW);
    expect(s.state).toBe('ok');
  });
});
