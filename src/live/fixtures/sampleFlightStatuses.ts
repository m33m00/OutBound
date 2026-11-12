/**
 * Sample flight statuses for when no backend is configured (UI shows a "Sample status" label).
 * Deterministic from the flight id (flight number + date + origin), so a row never flickers between renders.
 * Mix by hash % 12: 6 on time, then landing early, delayed (10, 25, 50 or 80 min, so every time tint
 * shows up), departed, canceled, arrived, diverted (one each; John, 2026-11-02).
 * Every flight moves on with the clock (round 192): on time, early and delayed ones read Departed once they've
 * left and Arrived once they've landed, so legs of one route always read in order.
 * Departed, arrived and diverted only once the clock allows it: a flight that hasn't left yet
 * reads on time, and one in the air reads departed, never arrived (John, 2026-11-03: an evening
 * leg showed Arrived while the route was still ahead).
 */
import { flightLookupKey, type FlightLookup, type FlightStatusEntry, type Movement } from '../flightStatus';

const MIN = 60_000;
/** Assumed block time for the sample arrival when the lookup has no arrival time. */
const SAMPLE_BLOCK_MIN = 150;
/** Delay sizes for the delayed bucket: yellow, orange, orange, red tints. */
const SAMPLE_DELAYS_MIN = [10, 25, 50, 80] as const;
/** How early an early flight lands. */
const SAMPLE_EARLY_MIN = [8, 12, 18] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const iso = (ms: number) => new Date(ms).toISOString();

function mv(airport: string | null, sched: number, est: number | null, act: number | null): Movement {
  const ref = act ?? est;
  return {
    airport,
    scheduledUtc: iso(sched),
    estimatedUtc: est == null ? null : iso(est),
    actualUtc: act == null ? null : iso(act),
    delayMin: ref == null ? null : Math.round((ref - sched) / MIN),
    terminal: null,
    gate: null,
  };
}

export function sampleFlightStatus(lookup: FlightLookup, nowMs: number): FlightStatusEntry {
  const key = flightLookupKey(lookup);
  const flightNumber = `${lookup.airline}${lookup.flightNumber}`.replace(/\s+/g, '').toUpperCase();
  const dep = lookup.departUtc;
  const arr = lookup.arriveUtc ?? dep + SAMPLE_BLOCK_MIN * MIN;
  const h = hash(key);
  const bucket = h % 12;
  const late = SAMPLE_DELAYS_MIN[(h >>> 4) % SAMPLE_DELAYS_MIN.length] * MIN;
  const early = SAMPLE_EARLY_MIN[(h >>> 4) % SAMPLE_EARLY_MIN.length] * MIN;
  let state: FlightStatusEntry['state'] = 'scheduled';
  let d = mv(lookup.from || null, dep, null, null);
  let a = mv(null, arr, null, null);
  if (bucket <= 6) {
    // On time, or (bucket 6) a tailwind lands it early. Like every other flight it moves on with the clock
    // (round 192, John: an earlier leg sat on no pill while the later leg read Arrived).
    const lands = bucket === 6 ? arr - early : arr;
    if (lands <= nowMs) {
      state = 'arrived';
      d = mv(lookup.from || null, dep, null, dep);
      a = mv(null, arr, null, lands);
    } else if (dep + 2 * MIN <= nowMs) {
      state = 'departed';
      d = mv(lookup.from || null, dep, null, dep);
      a = mv(null, arr, bucket === 6 ? lands : null, null);
    } else if (bucket === 6) {
      a = mv(null, arr, lands, null);
    }
  } else if (bucket === 7) {
    if (arr + late <= nowMs) {
      state = 'arrived';
      d = mv(lookup.from || null, dep, null, dep + late);
      a = mv(null, arr, null, arr + late);
    } else if (dep + late + 2 * MIN <= nowMs) {
      state = 'departed';
      d = mv(lookup.from || null, dep, null, dep + late);
      a = mv(null, arr, arr + late, null);
    } else {
      state = 'delayed';
      d = mv(lookup.from || null, dep, dep + late, null);
      a = mv(null, arr, arr + late, null);
    }
  } else if (bucket === 8 && arr + 5 * MIN <= nowMs) {
    state = 'arrived';
    d = mv(lookup.from || null, dep, null, dep + 5 * MIN);
    a = mv(null, arr, null, arr + 5 * MIN);
  } else if (bucket === 8 && dep <= nowMs) {
    state = 'departed';
    d = mv(lookup.from || null, dep, null, dep + 5 * MIN);
    a = mv(null, arr, arr + 5 * MIN, null);
  } else if (bucket === 9) {
    state = 'canceled';
  } else if (bucket === 10 && arr - 3 * MIN <= nowMs) {
    state = 'arrived';
    d = mv(lookup.from || null, dep, null, dep + 2 * MIN);
    a = mv(null, arr, null, arr - 3 * MIN);
  } else if (bucket === 10 && dep + 2 * MIN <= nowMs) {
    // Still in the air.
    state = 'departed';
    d = mv(lookup.from || null, dep, null, dep + 2 * MIN);
    a = mv(null, arr, arr - 3 * MIN, null);
  } else if (bucket === 11 && dep + 4 * MIN <= nowMs) {
    state = 'diverted';
    d = mv(lookup.from || null, dep, null, dep + 4 * MIN);
  }
  return {
    flightNumber,
    state,
    departure: d,
    arrival: a,
    providerUpdatedAt: iso(nowMs),
    asOf: iso(nowMs),
    stale: false,
    delayMin: d.delayMin ?? a.delayMin,
  };
}

export function sampleFlightStatuses(lookups: readonly FlightLookup[], nowMs: number): Record<string, FlightStatusEntry> {
  const out: Record<string, FlightStatusEntry> = {};
  for (const l of lookups) out[flightLookupKey(l)] = sampleFlightStatus(l, nowMs);
  return out;
}
