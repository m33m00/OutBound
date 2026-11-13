import { createMemoryProvider, searchItineraries, type Flight, type Itinerary } from '@/engine';
import { DATE, NOW, flight } from '@/engine/testHelpers';
import { flightLookupKey, type FlightState, type FlightStatus, type Movement } from '@/live';
import { sampleFlightStatuses } from '@/live/fixtures/sampleFlightStatuses';

import { legLookup, legStatus, requestableLegs, rowStatus, settleByClock, SETTLED_AFTER_MIN, statusLookups } from '../statusTags';

const MIN = 60_000;
const MINS = { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 };
const iso = (ms: number) => new Date(ms).toISOString();
const mv = (sched: number, est: number | null = null, act: number | null = null): Movement => ({
  airport: null,
  scheduledUtc: iso(sched),
  estimatedUtc: est == null ? null : iso(est),
  actualUtc: act == null ? null : iso(act),
  delayMin: null,
  terminal: null,
  gate: null,
});
const status = (f: Flight, state: FlightState, dep = mv(f.departUtc), arr = mv(f.arriveUtc)): FlightStatus => ({
  flightNumber: `${f.airline}${f.flightNumber}`,
  state,
  departure: dep,
  arrival: arr,
  providerUpdatedAt: null,
});
const keyOf = (f: Flight) => flightLookupKey(legLookup(f));

// John's example shape: an early leg into a connection, then a later leg (DFW to SEA to LAX).
const a = flight('A1', 'AA', 'DFW', 'SEA', '10:40', 260);
const b = flight('B2', 'AA', 'SEA', 'LAX', '17:00', 165);
async function route(): Promise<Itinerary> {
  const [it] = await searchItineraries(
    createMemoryProvider([a, b], {}),
    { origin: 'DFW', destination: 'LAX', date: DATE },
    { now: NOW },
  );
  return it;
}
const kinds = (it: Itinerary, byKey: Record<string, FlightStatus>, now: number) =>
  rowStatus(it, byKey, MINS, now).legs.map((l) => l.tag?.kind ?? 'none');

describe('leg pills follow the clock and each other (round 192, John)', () => {
  it("the bug: an early-landing leg the feed never moved on reads Arrived, like the later leg that's in", async () => {
    const it = await route();
    const late = b.arriveUtc + 2 * 60 * MIN;
    const byKey = {
      // Landing early (green 12:48 in John's screenshot), but still listed as scheduled.
      [keyOf(a)]: status(a, 'scheduled', mv(a.departUtc), mv(a.arriveUtc, a.arriveUtc - 12 * MIN)),
      [keyOf(b)]: status(b, 'arrived', mv(b.departUtc, null, b.departUtc), mv(b.arriveUtc, null, b.arriveUtc)),
    };
    // Before the fix the first leg had no pill at all.
    expect(kinds(it, byKey, NaN)).toEqual(['none', 'arrived']);
    expect(kinds(it, byKey, late)).toEqual(['arrived', 'arrived']);
    // It keeps its green early time.
    expect(rowStatus(it, byKey, MINS, late).legs[0].arrival?.newUtc).toBe(a.arriveUtc - 12 * MIN);
  });

  it('an actual landing or takeoff that has passed moves the leg on', () => {
    const t = a.departUtc + 30 * MIN;
    const tookOff = status(a, 'scheduled', mv(a.departUtc, null, a.departUtc + 5 * MIN));
    expect(settleByClock(a, tookOff, t)?.state).toBe('departed');
    expect(legStatus(a, tookOff, t).tag?.kind).toBe('departed');
    const landed = status(a, 'departed', mv(a.departUtc), mv(a.arriveUtc, null, a.arriveUtc - 2 * MIN));
    expect(settleByClock(a, landed, a.arriveUtc)?.state).toBe('arrived');
  });

  it('never from the schedule before an hour past landing: a late flight that has not left stays late', () => {
    const delayed = status(a, 'delayed', mv(a.departUtc, a.departUtc + 90 * MIN), mv(a.arriveUtc, a.arriveUtc + 90 * MIN));
    // Its old landing time has passed, its new one hasn't.
    expect(legStatus(a, delayed, a.arriveUtc + 30 * MIN).tag?.kind).toBe('delayed');
    expect(legStatus(a, delayed, a.arriveUtc + 90 * MIN + SETTLED_AFTER_MIN * MIN).tag?.kind).toBe('arrived');
    const onTime = status(a, 'scheduled');
    expect(legStatus(a, onTime, a.departUtc + 10 * MIN).tag).toBeNull();
    expect(legStatus(a, onTime, a.arriveUtc + (SETTLED_AFTER_MIN - 1) * MIN).tag).toBeNull();
    expect(legStatus(a, onTime, a.arriveUtc + SETTLED_AFTER_MIN * MIN).tag?.kind).toBe('arrived');
  });

  it('canceled and diverted stay as they are; no data means no guess', () => {
    const later = b.arriveUtc + 24 * 60 * MIN;
    expect(legStatus(a, status(a, 'canceled'), later).tag?.kind).toBe('canceled');
    expect(legStatus(a, status(a, 'diverted'), later).tag?.kind).toBe('diverted');
    expect(legStatus(a, undefined, later).tag).toBeNull();
  });

  it('a later leg in the air brings an earlier on-time leg along, but never past a real delay or cancellation', async () => {
    const it = await route();
    const t = b.departUtc + 20 * MIN; // after leg 1 should have landed, inside the hour
    const bGone = status(b, 'departed', mv(b.departUtc, null, b.departUtc));
    expect(kinds(it, { [keyOf(a)]: status(a, 'scheduled'), [keyOf(b)]: bGone }, t)).toEqual(['arrived', 'departed']);
    expect(kinds(it, { [keyOf(a)]: status(a, 'departed'), [keyOf(b)]: bGone }, t)).toEqual(['arrived', 'departed']);
    expect(kinds(it, { [keyOf(a)]: status(a, 'canceled'), [keyOf(b)]: bGone }, t)).toEqual(['canceled', 'departed']);
    const late = status(a, 'delayed', mv(a.departUtc, a.departUtc + 600 * MIN), mv(a.arriveUtc, a.arriveUtc + 600 * MIN));
    expect(kinds(it, { [keyOf(a)]: late, [keyOf(b)]: bGone }, t)).toEqual(['delayed', 'departed']);
  });

  it('sample statuses: across many routes and times, no earlier leg is ever less far along than a later one', async () => {
    const rank: Record<string, number> = { none: 0, delayed: 0, departed: 1, arrived: 2 };
    const pairs: [Flight, Flight][] = [];
    for (let i = 0; i < 60; i++) {
      const x = flight(`X${i}`, 'AA', 'DFW', 'SEA', `${String(6 + (i % 10)).padStart(2, '0')}:${i % 2 ? '10' : '40'}`, 240);
      const y = flight(`Y${i}`, 'UA', 'SEA', 'LAX', `${String(12 + (i % 8)).padStart(2, '0')}:05`, 160);
      pairs.push([x, y]);
    }
    let checked = 0;
    for (const [x, y] of pairs) {
      const its = await searchItineraries(
        createMemoryProvider([x, y], {}),
        { origin: 'DFW', destination: 'LAX', date: DATE },
        {
          now: NOW,
        },
      );
      const it = its[0];
      if (!it || it.legs.length !== 2) continue;
      for (let h = -2; h <= 30; h++) {
        const now = it.legs[0].flight.departUtc + h * 60 * MIN;
        const byKey = sampleFlightStatuses(statusLookups([it]), now);
        const ks = kinds(it, byKey, now);
        if (ks.includes('canceled') || ks.includes('diverted')) continue;
        if (ks[0] === 'delayed') continue; // a real delay can miss the connection
        expect(rank[ks[0]]).toBeGreaterThanOrEqual(rank[ks[1]]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe('no requests for a leg you can no longer board (round 192, John)', () => {
  it('drops canceled, departed, arrived and diverted legs; keeps on-time and late ones', async () => {
    const it = await route();
    const t = a.departUtc - 60 * MIN;
    const at = (sa: FlightStatus, sb: FlightStatus) =>
      requestableLegs([0, 1], rowStatus(it, { [keyOf(a)]: sa, [keyOf(b)]: sb }, MINS, t));
    expect(at(status(a, 'scheduled'), status(b, 'scheduled'))).toEqual([0, 1]);
    expect(at(status(a, 'canceled'), status(b, 'scheduled'))).toEqual([1]);
    expect(at(status(a, 'scheduled'), status(b, 'canceled'))).toEqual([0]);
    // A fully canceled route has nothing to request, so no checkboxes and no button.
    expect(at(status(a, 'canceled'), status(b, 'canceled'))).toEqual([]);
    expect(at(status(a, 'departed'), status(b, 'delayed', mv(b.departUtc, b.departUtc + 30 * MIN)))).toEqual([1]);
    expect(at(status(a, 'diverted'), status(b, 'arrived'))).toEqual([]);
    // Already-requested legs aren't offered in the first place.
    expect(requestableLegs([1], rowStatus(it, {}, MINS, t))).toEqual([1]);
    expect(requestableLegs([0, 1], undefined)).toEqual([0, 1]);
  });
});
