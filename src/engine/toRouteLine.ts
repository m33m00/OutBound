import type { LonLat, RouteLine } from '@/map';

import type { FlightDataProvider, Itinerary } from './types';

/** Map an itinerary onto the globe's RouteLine (id = itinerary id). */
export function toRouteLine(
  itinerary: Itinerary,
  airport: FlightDataProvider['getAirport'],
): RouteLine {
  const coord = (code: string): LonLat => {
    const a = airport(code);
    if (!a) throw new RangeError(`Unknown airport ${code}`);
    return [a.lon, a.lat];
  };
  return {
    id: itinerary.id,
    legs: itinerary.legs.map(({ flight, seats }) => ({
      id: flight.id,
      from: coord(flight.from),
      to: coord(flight.to),
      fromCode: flight.from,
      toCode: flight.to,
      tier: seats.tier,
      source: seats.source,
      // Scheduled times, for the selected route's leg durations (item 15).
      departUtc: flight.departUtc,
      arriveUtc: flight.arriveUtc,
    })),
  };
}
