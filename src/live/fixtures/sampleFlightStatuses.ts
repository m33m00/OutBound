/**
 * Sample flight statuses for when no backend is configured (UI shows a "Sample status" label).
 * Deterministic from the flight id (flight number + date + origin), so a row never flickers between renders.
 * Mix by hash % 12: 7 on time, then delayed 25m, departed, canceled, arrived, diverted (one each).
 */
import { flightLookupKey, type FlightLookup, type FlightStatusEntry, type Movement } from '../flightStatus';

const MIN = 60_000;
/** Assumed block time for the sample arrival (the lookup has no arrival time). */
const SAMPLE_BLOCK_MIN = 150;

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
  const arr = dep + SAMPLE_BLOCK_MIN * MIN;
  const bucket = hash(key) % 12;
  const late = 25 * MIN;
  let state: FlightStatusEntry['state'] = 'scheduled';
  let d = mv(lookup.from || null, dep, null, null);
  let a = mv(null, arr, null, null);
  if (bucket === 7) {
    state = 'delayed';
    d = mv(lookup.from || null, dep, dep + late, null);
    a = mv(null, arr, arr + late, null);
  } else if (bucket === 8) {
    state = 'departed';
    d = mv(lookup.from || null, dep, null, dep + 5 * MIN);
    a = mv(null, arr, arr + 5 * MIN, null);
  } else if (bucket === 9) {
    state = 'canceled';
  } else if (bucket === 10) {
    state = 'arrived';
    d = mv(lookup.from || null, dep, null, dep + 2 * MIN);
    a = mv(null, arr, null, arr - 3 * MIN);
  } else if (bucket === 11) {
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
