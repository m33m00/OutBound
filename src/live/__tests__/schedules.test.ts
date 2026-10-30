import { AIRPORTS } from '@/engine';

import { SCHEDULE_CONFIG as CFG, type ScheduleConfig } from '../../../supabase/functions/_shared/scheduleConfig';
import {
  addDaysIso,
  fidsPath,
  localDateIn,
  newestPull,
  newReadCache,
  parseAirports,
  parseDays,
  parseFidsDepartures,
  parseReadQuery,
  planPull,
  readCacheKey,
  rowsToFlights,
  runSync,
  splitFlightNumber,
  type ScheduleRow,
  type ScheduleStore,
  type SyncDeps,
  type UpstreamResult,
} from '../../../supabase/functions/_shared/schedules';
import * as F from '../fixtures/fids-departures-samples';

const DAY = 86_400_000;
/** 2026-10-30 14:00Z = 09:00 CDT. */
const NOW = Date.UTC(2026, 9, 30, 14);
const PULLED = new Date(NOW).toISOString();
const KNOWN = new Set(CFG.airports.map((a) => a.code));

describe('schedule config', () => {
  it('pulls exactly the airports in the app table, with the same time zones', () => {
    expect(CFG.airports.map((a) => a.code).sort()).toEqual(Object.keys(AIRPORTS).sort());
    for (const a of CFG.airports) expect(a.tz).toBe(AIRPORTS[a.code].tz);
  });

  it('keeps every FIDS window within the 12 h AeroDataBox limit', () => {
    const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    for (const w of CFG.windows) {
      expect(min(w.to) - min(w.from)).toBeGreaterThan(0);
      expect(min(w.to) - min(w.from)).toBeLessThanOrEqual(12 * 60);
    }
    expect(CFG.windows[0].from).toBe('00:00');
    expect(CFG.windows[CFG.windows.length - 1].to).toBe('23:59');
  });

  it('daily days stay inside the 0-7 search range', () => {
    for (const d of CFG.dailyDays) expect(d).toBeLessThanOrEqual(CFG.maxDayOffset);
    expect(CFG.maxDayOffset).toBe(7);
  });
});

describe('dates', () => {
  it('adds days across a month end', () => {
    expect(addDaysIso('2026-10-30', 2)).toBe('2026-11-01');
    expect(addDaysIso('2026-11-01', -2)).toBe('2026-10-30');
  });

  it('reads the local date in each zone', () => {
    const lateUtc = Date.UTC(2026, 9, 31, 3); // 22:00 CDT on the 30th
    expect(localDateIn(lateUtc, 'America/Chicago')).toBe('2026-10-30');
    expect(localDateIn(lateUtc, 'America/New_York')).toBe('2026-10-30');
    expect(localDateIn(lateUtc, 'UTC')).toBe('2026-10-31');
  });
});

describe('parseDays / parseAirports', () => {
  it('defaults to the daily days and all airports', () => {
    expect(parseDays(null)).toEqual(CFG.dailyDays);
    expect(parseDays('')).toEqual(CFG.dailyDays);
    expect(parseAirports(null)).toHaveLength(CFG.airports.length);
  });

  it('accepts ranges and lists', () => {
    expect(parseDays('0-7')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(parseDays('7, 0,1,1')).toEqual([0, 1, 7]);
  });

  it('rejects bad or out-of-range days', () => {
    expect(parseDays('0-8')).toBeNull();
    expect(parseDays('3-1')).toBeNull();
    expect(parseDays('x')).toBeNull();
    expect(parseDays('-1')).toBeNull();
  });

  it('keeps config order and rejects unknown airports', () => {
    expect(parseAirports('dfw,DAL')!.map((a) => a.code)).toEqual(['DAL', 'DFW']);
    expect(parseAirports('DAL,XXX')).toBeNull();
  });
});

describe('planPull', () => {
  it('counts days in each airport’s own calendar', () => {
    const lateUtc = Date.UTC(2026, 9, 31, 4, 30); // 23:30 CDT / 21:30 PDT on the 30th, 00:30 EDT on the 31st
    const plan = planPull(lateUtc, [0, 7], CFG.airports.filter((a) => ['DAL', 'ATL'].includes(a.code)));
    expect(plan).toEqual([
      { airport: 'ATL', tz: 'America/New_York', date: '2026-10-31' },
      { airport: 'ATL', tz: 'America/New_York', date: '2026-11-07' },
      { airport: 'DAL', tz: 'America/Chicago', date: '2026-10-30' },
      { airport: 'DAL', tz: 'America/Chicago', date: '2026-11-06' },
    ]);
  });

  it('builds a departures-only, operator-only FIDS path', () => {
    const p = fidsPath('DAL', '2026-10-30', { from: '00:00', to: '12:00' });
    expect(p.startsWith('/flights/airports/iata/DAL/2026-10-30T00:00/2026-10-30T12:00?')).toBe(true);
    for (const q of ['withLeg=true', 'direction=Departure', 'withCodeshared=false', 'withCargo=false', 'withPrivate=false']) {
      expect(p).toContain(q);
    }
  });
});

describe('splitFlightNumber', () => {
  it('splits on the airline code', () => {
    expect(splitFlightNumber('WN 311', 'WN')).toEqual({ airline: 'WN', flightNumber: '311' });
    expect(splitFlightNumber('b6 1234', 'B6')).toEqual({ airline: 'B6', flightNumber: '1234' });
    expect(splitFlightNumber('AA100A', null)).toEqual({ airline: 'AA', flightNumber: '100A' });
  });

  it('falls back to the number when the airline field disagrees', () => {
    expect(splitFlightNumber('DL 2210', 'XX')).toEqual({ airline: 'DL', flightNumber: '2210' });
  });

  it('rejects junk', () => {
    expect(splitFlightNumber('', 'WN')).toBeNull();
    expect(splitFlightNumber('N123AB', null)).toBeNull();
    expect(splitFlightNumber(42, 'WN')).toBeNull();
  });
});

describe('parseFidsDepartures', () => {
  const rows = parseFidsDepartures(F.FIDS_DAL_MORNING, 'DAL', KNOWN, '2026-10-30', PULLED);

  it('keeps operating passenger flights to known airports, canceled ones included', () => {
    expect(rows.map((r) => r.id)).toEqual(['WN311-2026-10-30-DAL', 'WN1205-2026-10-30-DAL']);
  });

  it('fills every column in the engine’s shape', () => {
    expect(rows[0]).toEqual({
      id: 'WN311-2026-10-30-DAL',
      airline: 'WN',
      flight_number: '311',
      origin: 'DAL',
      destination: 'DEN',
      depart_utc: '2026-10-30T12:30:00.000Z',
      arrive_utc: '2026-10-30T14:35:00.000Z',
      local_date: '2026-10-30',
      pulled_at: PULLED,
    });
  });

  it('takes the local date from the provider, not the UTC date', () => {
    const late = {
      departures: [
        {
          number: 'WN 9',
          codeshareStatus: 'IsOperator',
          isCargo: false,
          airline: { iata: 'WN' },
          departure: { scheduledTime: { utc: '2026-10-31 03:30Z', local: '2026-10-30 22:30-05:00' } },
          arrival: { airport: { iata: 'PHX' }, scheduledTime: { utc: '2026-10-31 05:30Z' } },
        },
      ],
    };
    expect(parseFidsDepartures(late, 'DAL', KNOWN, '2026-10-29', PULLED)[0].local_date).toBe('2026-10-30');
  });

  it('falls back to the pulled date when no local time is given', () => {
    const noLocal = {
      departures: [
        {
          number: 'WN 9',
          airline: { iata: 'WN' },
          departure: { scheduledTime: { utc: '2026-10-30 13:00Z' } },
          arrival: { airport: { iata: 'PHX' }, scheduledTime: { utc: '2026-10-30 15:00Z' } },
        },
      ],
    };
    expect(parseFidsDepartures(noLocal, 'DAL', KNOWN, '2026-10-30', PULLED)[0].id).toBe('WN9-2026-10-30-DAL');
  });

  it('skips impossible block times and round trips to the origin', () => {
    const bad = {
      departures: [
        { number: 'WN 1', departure: { scheduledTime: { utc: '2026-10-30 13:00Z' } }, arrival: { airport: { iata: 'PHX' }, scheduledTime: { utc: '2026-10-30 12:00Z' } } },
        { number: 'WN 2', departure: { scheduledTime: { utc: '2026-10-30 13:00Z' } }, arrival: { airport: { iata: 'PHX' }, scheduledTime: { utc: '2026-10-31 13:00Z' } } },
        { number: 'WN 3', departure: { scheduledTime: { utc: '2026-10-30 13:00Z' } }, arrival: { airport: { iata: 'DAL' }, scheduledTime: { utc: '2026-10-30 14:00Z' } } },
      ],
    };
    expect(parseFidsDepartures(bad, 'DAL', KNOWN, '2026-10-30', PULLED)).toEqual([]);
  });

  it('returns nothing for an empty or odd body', () => {
    expect(parseFidsDepartures(null, 'DAL', KNOWN, '2026-10-30', PULLED)).toEqual([]);
    expect(parseFidsDepartures({ departures: 'x' }, 'DAL', KNOWN, '2026-10-30', PULLED)).toEqual([]);
    expect(parseFidsDepartures({ departures: [null, 3] }, 'DAL', KNOWN, '2026-10-30', PULLED)).toEqual([]);
  });
});

/** In-memory store and upstream for runSync. */
function harness(answers: Record<string, UpstreamResult | Error>, cfg: ScheduleConfig = CFG) {
  const saved: { origin: string; date: string; rows: ScheduleRow[] }[] = [];
  const pruned: string[] = [];
  const usage: { units: number; month: string }[] = [];
  const calls: string[] = [];
  const sleeps: number[] = [];
  const store: ScheduleStore = {
    async replaceDay(origin, date, rows) {
      saved.push({ origin, date, rows });
    },
    async pruneBefore(d) {
      pruned.push(d);
    },
  };
  const deps: SyncDeps = {
    async fetchUpstream(path) {
      calls.push(path);
      const key = Object.keys(answers).find((k) => path.includes(k));
      const a = key ? answers[key] : { status: 204, body: null };
      if (a instanceof Error) throw a;
      return a;
    },
    store,
    usage: { record: async (r) => void usage.push({ units: r.units, month: r.month }) },
    sleep: async (ms) => void sleeps.push(ms),
    log: () => {},
  };
  return { deps, saved, pruned, usage, calls, sleeps, cfg };
}

describe('runSync', () => {
  const plan = [{ airport: 'DAL', tz: 'America/Chicago', date: '2026-10-30' }];

  it('saves a day once both windows answer, de-duplicating the noon seam', async () => {
    const h = harness({
      '2026-10-30T00:00': { status: 200, body: F.FIDS_DAL_NOON_IN_MORNING },
      '2026-10-30T12:00': { status: 200, body: F.FIDS_DAL_AFTERNOON },
    });
    const s = await runSync(h.deps, plan, NOW);
    expect(s).toEqual({ calls: 2, daysSaved: 1, rowsSaved: 3, failed: [] });
    expect(h.saved[0].rows.map((r) => r.id).sort()).toEqual([
      'WN1205-2026-10-30-DAL',
      'WN2405-2026-10-30-DAL',
      'WN311-2026-10-30-DAL',
    ]);
  });

  it('logs one usage row per answered call and waits between calls', async () => {
    const h = harness({});
    await runSync(h.deps, [...plan, { airport: 'DFW', tz: 'America/Chicago', date: '2026-10-30' }], NOW);
    expect(h.calls).toHaveLength(4);
    expect(h.usage).toEqual(Array(4).fill({ units: CFG.usage.unitsPerCall, month: '2026-10' }));
    expect(h.sleeps).toEqual(Array(3).fill(CFG.callGapMs));
  });

  it('treats 204 as a day with no flights (still saved, so dropped flights are cleared)', async () => {
    const h = harness({});
    const s = await runSync(h.deps, plan, NOW);
    expect(s.daysSaved).toBe(1);
    expect(h.saved[0].rows).toEqual([]);
  });

  it('leaves a day untouched when any window fails', async () => {
    const h = harness({
      '2026-10-30T00:00': { status: 200, body: F.FIDS_DAL_MORNING },
      '2026-10-30T12:00': { status: 429, body: null },
    });
    const s = await runSync(h.deps, plan, NOW);
    expect(s.daysSaved).toBe(0);
    expect(s.failed).toEqual(['DAL 2026-10-30: upstream 429']);
    expect(h.saved).toEqual([]);
  });

  it('survives a network error and carries on with the next day', async () => {
    const h = harness({ 'DAL/2026-10-30T00:00': new Error('timeout') });
    const s = await runSync(h.deps, [...plan, { airport: 'DFW', tz: 'America/Chicago', date: '2026-10-30' }], NOW);
    expect(s.failed).toEqual(['DAL 2026-10-30: network timeout']);
    expect(s.daysSaved).toBe(1);
    expect(h.saved[0].origin).toBe('DFW');
  });

  it('keeps going when usage logging or the store fails', async () => {
    const h = harness({});
    h.deps.usage = { record: async () => Promise.reject(new Error('no table')) };
    h.deps.store = { ...h.deps.store, replaceDay: async () => Promise.reject(new Error('down')) };
    const s = await runSync(h.deps, plan, NOW);
    expect(s.failed).toEqual(['DAL 2026-10-30: store down']);
  });

  it('prunes days older than keepPastDays', async () => {
    const h = harness({});
    await runSync(h.deps, [], NOW);
    expect(h.pruned).toEqual([addDaysIso('2026-10-30', -CFG.keepPastDays)]);
    expect(h.calls).toEqual([]);
  });
});

describe('read side', () => {
  const q = (s: string) => new URLSearchParams(s);

  it('accepts a known airport and a search-sized window', () => {
    const from = NOW - DAY;
    const to = NOW + 3 * DAY;
    expect(parseReadQuery(q(`airport=dal&from=${from}&to=${to}`), NOW)).toEqual({ airport: 'DAL', fromUtc: from, toUtc: to });
  });

  it('rejects unknown airports and bad or oversized windows', () => {
    expect(parseReadQuery(q(`airport=XXX&from=${NOW}&to=${NOW + DAY}`), NOW)).toBeNull();
    expect(parseReadQuery(q(`airport=DAL&from=${NOW}&to=${NOW}`), NOW)).toBeNull();
    expect(parseReadQuery(q(`airport=DAL&from=abc&to=${NOW}`), NOW)).toBeNull();
    expect(parseReadQuery(q(`airport=DAL&from=${NOW}&to=${NOW + CFG.maxReadWindowMs + 1}`), NOW)).toBeNull();
    expect(parseReadQuery(q(`airport=DAL&from=${NOW - 10 * DAY}&to=${NOW - 9 * DAY}`), NOW)).toBeNull();
    expect(parseReadQuery(q(`airport=DAL&from=${NOW + 10 * DAY}&to=${NOW + 12 * DAY}`), NOW)).toBeNull();
  });

  it('turns rows into sorted app flights and drops broken rows', () => {
    const rows = parseFidsDepartures(F.FIDS_DAL_NOON_IN_MORNING, 'DAL', KNOWN, '2026-10-30', PULLED).reverse();
    const flights = rowsToFlights([...rows, { id: 'bad', airline: 'WN', flight_number: '1', origin: 'DAL', destination: 'DEN', depart_utc: 'x', arrive_utc: 'y' }]);
    expect(flights.map((f) => f.id)).toEqual(['WN311-2026-10-30-DAL', 'WN1205-2026-10-30-DAL', 'WN2405-2026-10-30-DAL']);
    expect(flights[0]).toEqual({
      id: 'WN311-2026-10-30-DAL',
      airline: 'WN',
      flightNumber: '311',
      from: 'DAL',
      to: 'DEN',
      departUtc: Date.UTC(2026, 9, 30, 12, 30),
      arriveUtc: Date.UTC(2026, 9, 30, 14, 35),
    });
  });

  it('reports the newest pull time', () => {
    expect(newestPull([{ pulled_at: '2026-10-29T10:00:00Z' }, { pulled_at: '2026-10-30T10:00:00Z' }, {}])).toBe('2026-10-30T10:00:00Z');
    expect(newestPull([])).toBeNull();
  });

  it('caches reads until they expire and evicts the oldest when full', () => {
    const cache = newReadCache<number>({ ...CFG, maxReadCacheEntries: 2 });
    const key = readCacheKey({ airport: 'DAL', fromUtc: 1, toUtc: 2 });
    expect(key).toBe('DAL|1|2');
    cache.set('a', 1, 0);
    expect(cache.get('a', CFG.readCacheMs - 1)).toBe(1);
    expect(cache.get('a', CFG.readCacheMs)).toBeUndefined();
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    cache.set('c', 3, 0);
    expect(cache.size).toBe(2);
    expect(cache.get('a', 1)).toBeUndefined();
    expect(cache.get('c', 1)).toBe(3);
  });
});
