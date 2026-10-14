import { AIRPORTS } from '../airports';
import { createMemoryProvider } from '../memoryProvider';
import { addDays, zonedToUtc } from '../time';
import type { Flight, FlightDataProvider, SeatReport, SeatSource } from '../types';

import { SAMPLE_SCHEDULE } from './schedule';

/** Small deterministic hash so sample seats are stable per flight. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SOURCES: readonly (SeatSource | null)[] = ['reported', 'estimate', 'estimate', 'typical', null];

/**
 * SAMPLE DATA provider: the daily sample schedule repeated for `days` local
 * dates from `startDate`, with made-up seat readings (all four sources).
 */
export function createSampleProvider(startDate: string, days = 8, now = Date.now()): FlightDataProvider {
  const flights: Flight[] = [];
  const seats: Record<string, SeatReport[]> = {};
  for (let d = -1; d < days; d++) {
    const date = addDays(startDate, d);
    for (const [airline, flightNumber, from, to, time, blockMin] of SAMPLE_SCHEDULE) {
      const departUtc = zonedToUtc(date, time, AIRPORTS[from].tz);
      const id = `${airline}${flightNumber}-${date}-${from}`;
      flights.push({ id, airline, flightNumber, from, to, departUtc, arriveUtc: departUtc + blockMin * 60_000 });
      const h = hash(id);
      const source = SOURCES[h % SOURCES.length];
      if (source) {
        const openSeats = (h >>> 3) % 70;
        const listed = (h >>> 9) % 20;
        seats[id] = [{ source, openSeats, listed, asOf: now - ((h >>> 13) % 180) * 60_000 }];
      }
    }
  }
  return createMemoryProvider(flights, seats);
}
