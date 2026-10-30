import { createMemoryProvider, searchItineraries, type Flight, type Itinerary } from '@/engine';
import { DATE, NOW, flight } from '@/engine/testHelpers';
import { flightLookupKey, type FlightState, type FlightStatus, type Movement } from '@/live';

import {
  departedFirst,
  legLookup,
  legStatus,
  resultsBanner,
  rowStatus,
  spokenDuration,
  statusLookups,
} from '../statusTags';

const MIN = 60_000;
const MINS = { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 };
const iso = (ms: number) => new Date(ms).toISOString();

function mv(sched: number, est: number | null = null, act: number | null = null): Movement {
  const ref = act ?? est;
  return {
    airport: null,
    scheduledUtc: iso(sched),
    estimatedUtc: est == null ? null : iso(est),
    actualUtc: act == null ? null : iso(act),
    delayMin: ref == null ? null : Math.round((ref - sched) / MIN),
    terminal: null,
    gate: null,
  };
}

function status(f: Flight, state: FlightState, depLateMin = 0, arrLateMin: number | null = null): FlightStatus {
  return {
    flightNumber: `${f.airline}${f.flightNumber}`,
    state,
    departure: mv(f.departUtc, depLateMin ? f.departUtc + depLateMin * MIN : null),
    arrival: mv(f.arriveUtc, arrLateMin == null ? null : f.arriveUtc + arrLateMin * MIN),
    providerUpdatedAt: null,
  };
}

const keyOf = (f: Flight) => flightLookupKey(legLookup(f));

// BNA 15:10 CDT -> DFW (120m, arrives 17:10), DFW -> LAX departs 18:20 (70m same-airline layover).
const a = flight('A1', 'AA', 'BNA', 'DFW', '15:10', 120);
const b = flight('B2', 'AA', 'DFW', 'LAX', '18:20', 180);

async function oneStop(): Promise<Itinerary> {
  const [it] = await searchItineraries(createMemoryProvider([a, b], {}), { origin: 'BNA', destination: 'LAX', date: DATE }, { now: NOW });
  return it;
}

describe('legStatus', () => {
  it('scheduled: no tag, nothing struck', () => {
    const v = legStatus(a, status(a, 'scheduled'));
    expect(v.tag).toBeNull();
    expect(v.struck).toBe(false);
    expect(v.scheduledText).toBe('3:10 PM');
  });

  it('delayed: minutes from the estimate, old time struck, new time shown and spoken', () => {
    const v = legStatus(a, status(a, 'delayed', 25));
    expect(v.tag).toEqual({
      kind: 'delayed',
      label: 'Delayed 25m',
      spoken: 'Delayed 25 minutes, was 3:10 PM, now 3:35 PM',
    });
    expect(v).toMatchObject({ struck: true, newUtc: a.departUtc + 25 * MIN, newText: '3:35 PM' });
  });

  it('delayed: actual beats estimated; long delays read as hours', () => {
    const s = status(a, 'delayed', 30);
    s.departure.actualUtc = iso(a.departUtc + 90 * MIN);
    const v = legStatus(a, s);
    expect(v.tag?.label).toBe('Delayed 1h 30m');
    expect(v.tag?.spoken).toBe('Delayed 1 hour 30 minutes, was 3:10 PM, now 4:40 PM');
  });

  it('delayed: falls back to delayMin; with no time at all the tag has no number and nothing is struck', () => {
    const s = status(a, 'delayed');
    s.departure.delayMin = 15;
    expect(legStatus(a, s).newText).toBe('3:25 PM');
    const v = legStatus(a, status(a, 'delayed'));
    expect(v.tag).toEqual({ kind: 'delayed', label: 'Delayed', spoken: 'Delayed' });
    expect(v.struck).toBe(false);
  });

  it('departed and arrived: gray words, time not struck', () => {
    expect(legStatus(a, status(a, 'departed')).tag).toMatchObject({ kind: 'departed', label: 'Departed' });
    expect(legStatus(a, status(a, 'arrived')).tag).toMatchObject({ kind: 'arrived', label: 'Arrived' });
    expect(legStatus(a, status(a, 'departed')).struck).toBe(false);
  });

  it('canceled and diverted: time struck, spoken with the old time', () => {
    const c = legStatus(a, status(a, 'canceled'));
    expect(c).toMatchObject({ struck: true, newText: null });
    expect(c.tag).toEqual({ kind: 'canceled', label: 'Canceled', spoken: 'Canceled, was 3:10 PM' });
    expect(legStatus(a, status(a, 'diverted')).tag).toMatchObject({ kind: 'diverted', label: 'Diverted' });
  });

  it('no live status: no tag and nothing struck, even past the scheduled time', () => {
    expect(legStatus(a, undefined)).toMatchObject({ tag: null, struck: false, newText: null });
  });
});

describe('rowStatus', () => {
  it('no tags and no risk when everything is on time', async () => {
    const it = await oneStop();
    const s = rowStatus(it, { [keyOf(a)]: status(a, 'scheduled'), [keyOf(b)]: status(b, 'scheduled') }, MINS);
    expect(s).toMatchObject({ risks: [], dimmed: false, canceled: false, spoken: [] });
  });

  it('flags a connection at risk when a delay leaves less than the minimum connection', async () => {
    const it = await oneStop();
    // 25m late in, 70m scheduled layover -> 45m < 60 same airline.
    const s = rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 25) }, MINS);
    expect(s.risks).toEqual([{ index: 0, airport: 'DFW', layoverMin: 45, minConnectMin: 60 }]);
    expect(s.spoken).toEqual([
      'AA A1: Delayed 25 minutes, was 3:10 PM, now 3:35 PM',
      'Connection at risk at DFW',
    ]);
  });

  it('uses the estimated arrival when the provider gives one', async () => {
    const it = await oneStop();
    // Late departure made up in the air: arrives only 5m late -> 65m, fine.
    const s = rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 25, 5) }, MINS);
    expect(s.risks).toEqual([]);
  });

  it('gives the expected arrival at the end of the route once it moves 5+ minutes (design round 25)', async () => {
    const it = await oneStop();
    // Last leg lands 19:20 PDT; 40m late -> 8:00 PM local.
    const late = rowStatus(it, { [keyOf(b)]: status(b, 'delayed', 40) }, MINS);
    expect(late.arrival).toEqual({ newUtc: b.arriveUtc + 40 * MIN, newText: '8:00 PM' });
    // Within 4 minutes counts as on time; no status on the last leg gives nothing.
    expect(rowStatus(it, { [keyOf(b)]: status(b, 'scheduled', 0, 4) }, MINS).arrival).toBeUndefined();
    expect(rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 25) }, MINS).arrival).toBeUndefined();
  });

  it('a delayed onward flight widens the connection', async () => {
    const it = await oneStop();
    const s = rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 25), [keyOf(b)]: status(b, 'delayed', 20) }, MINS);
    expect(s.risks).toEqual([]);
  });

  it('uses the switching minimum for different airlines', async () => {
    const b2 = { ...flight('B3', 'UA', 'DFW', 'LAX', '18:50', 180) };
    const [it] = await searchItineraries(createMemoryProvider([a, b2], {}), { origin: 'BNA', destination: 'LAX', date: DATE }, { now: NOW });
    // 100m scheduled; 15m late -> 85m < 90 switching.
    const s = rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 15) }, MINS);
    expect(s.risks).toMatchObject([{ airport: 'DFW', layoverMin: 85, minConnectMin: 90 }]);
    expect(rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 15) }, { ...MINS, minConnectSwitchMin: 60 }).risks).toEqual([]);
  });

  it('no risk once the onward leg has departed', async () => {
    const it = await oneStop();
    const s = rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 25), [keyOf(b)]: status(b, 'departed') }, MINS);
    expect(s.risks).toEqual([]);
  });

  it('a canceled leg shows Canceled only: no at-risk tag, route marked canceled', async () => {
    const it = await oneStop();
    const inbound = rowStatus(it, { [keyOf(a)]: status(a, 'canceled', 25) }, MINS);
    expect(inbound).toMatchObject({ risks: [], canceled: true, dimmed: false });
    expect(inbound.spoken).toEqual(['AA A1: Canceled, was 3:10 PM']);
    const onward = rowStatus(it, { [keyOf(a)]: status(a, 'delayed', 25), [keyOf(b)]: status(b, 'canceled') }, MINS);
    expect(onward.risks).toEqual([]);
    expect(onward.canceled).toBe(true);
  });

  it('no live status: no dimming and no at-risk, even for a tight scheduled connection', async () => {
    const tight = flight('B9', 'AA', 'DFW', 'LAX', '17:40', 180); // 30m scheduled (a "Show Them" route)
    const [it] = await searchItineraries(createMemoryProvider([a, tight], {}), { origin: 'BNA', destination: 'LAX', date: DATE }, { now: NOW, minConnectSameAirlineMin: 30 });
    expect(rowStatus(it, {}, MINS)).toEqual(expect.objectContaining({ risks: [], dimmed: false, canceled: false, spoken: [] }));
  });

  it('dims the row when the first leg departed or arrived', async () => {
    const it = await oneStop();
    expect(rowStatus(it, { [keyOf(a)]: status(a, 'departed') }, MINS).dimmed).toBe(true);
    expect(rowStatus(it, { [keyOf(a)]: status(a, 'arrived'), [keyOf(b)]: status(b, 'departed') }, MINS).dimmed).toBe(true);
    expect(rowStatus(it, { [keyOf(b)]: status(b, 'delayed', 10) }, MINS).dimmed).toBe(false);
  });

  it('a departed inbound still checks the connection (it can land late)', async () => {
    const it = await oneStop();
    const s = rowStatus(it, { [keyOf(a)]: status(a, 'departed', 30, 30) }, MINS);
    expect(s.risks).toMatchObject([{ airport: 'DFW', layoverMin: 40 }]);
  });
});

describe('statusLookups', () => {
  it('one lookup per distinct flight, local date at the origin', async () => {
    const it = await oneStop();
    const lookups = statusLookups([it, it]);
    expect(lookups).toHaveLength(2);
    expect(lookups[0]).toEqual({ airline: 'AA', flightNumber: 'A1', date: DATE, from: 'BNA', departUtc: a.departUtc });
  });
});

describe('spokenDuration', () => {
  it('reads minutes and hours', () => {
    expect(spokenDuration(1)).toBe('1 minute');
    expect(spokenDuration(25)).toBe('25 minutes');
    expect(spokenDuration(60)).toBe('1 hour');
    expect(spokenDuration(125)).toBe('2 hours 5 minutes');
  });
});

describe('resultsBanner (Q-047)', () => {
  it('no banner when there are routes', () => {
    expect(resultsBanner({ results: [{}], hiddenCount: 0 })).toBeNull();
  });
  it('no flights in the market that day', () => {
    expect(resultsBanner({ results: [], hiddenCount: 0 })).toEqual({ kind: 'noFlights', text: 'No Flights Found on Selected Date' });
  });
  it('filters hid routes: count, singular, Title Case action', () => {
    expect(resultsBanner({ results: [], hiddenCount: 3 })).toEqual({
      kind: 'hidden',
      text: '3 routes hidden by your filters',
      action: 'Show Them',
      count: 3,
    });
    expect(resultsBanner({ results: [], hiddenCount: 1 })?.text).toBe('1 route hidden by your filters');
  });
});

describe('departedFirst (John, 2026-10-30)', () => {
  const row = (dimmed: boolean) => ({ legs: [], risks: [], dimmed, canceled: false, spoken: [] });
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('moves routes that already left to the top, keeping departure order in each group', () => {
    const statuses = { a: row(false), b: row(true), c: row(false), d: row(true) };
    expect(departedFirst(list, statuses).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('keeps the list as is when nothing left, everything left, or there is no status yet', () => {
    expect(departedFirst(list, { a: row(false) })).toBe(list);
    expect(departedFirst(list, { a: row(true), b: row(true), c: row(true), d: row(true) })).toBe(list);
    expect(departedFirst(list)).toBe(list);
  });
});
