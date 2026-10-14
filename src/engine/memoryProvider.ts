import { AIRPORTS } from './airports';
import type { Airport, Flight, FlightDataProvider, SeatReport } from './types';

/** A FlightDataProvider over in-memory arrays. Used by tests and sample data. */
export function createMemoryProvider(
  flights: readonly Flight[],
  seatReports: Readonly<Record<string, readonly SeatReport[]>> = {},
  airports: Readonly<Record<string, Airport>> = AIRPORTS,
): FlightDataProvider {
  const byOrigin = new Map<string, Flight[]>();
  for (const f of flights) {
    const list = byOrigin.get(f.from) ?? [];
    list.push(f);
    byOrigin.set(f.from, list);
  }
  for (const list of byOrigin.values()) list.sort((a, b) => a.departUtc - b.departUtc);

  return {
    async getDepartures(airport, fromUtc, toUtc) {
      return (byOrigin.get(airport) ?? []).filter(
        (f) => f.departUtc >= fromUtc && f.departUtc < toUtc,
      );
    },
    async getSeatReports(flightId) {
      return [...(seatReports[flightId] ?? [])];
    },
    getAirport(code) {
      return airports[code];
    },
  };
}
