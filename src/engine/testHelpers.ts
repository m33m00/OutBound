/** Test-only helpers for engine tests. */
import { AIRPORTS } from './airports';
import { zonedToUtc } from './time';
import type { Flight, SeatReport } from './types';

export const DATE = '2026-10-20';
/** 2026-10-19 12:00 UTC: the day before DATE everywhere in the US. */
export const NOW = Date.UTC(2026, 9, 19, 12, 0);

/** A test flight departing `time` local at `from` on `date`. */
export function flight(
  id: string,
  airline: string,
  from: string,
  to: string,
  time: string,
  blockMin: number,
  date = DATE,
): Flight {
  const departUtc = zonedToUtc(date, time, AIRPORTS[from].tz);
  return { id, airline, flightNumber: id, from, to, departUtc, arriveUtc: departUtc + blockMin * 60_000 };
}

export function seats(source: SeatReport['source'], net: number, asOf = NOW): SeatReport[] {
  return [{ source, openSeats: net + 10, listed: 10, asOf }];
}
