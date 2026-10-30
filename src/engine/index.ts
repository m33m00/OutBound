/**
 * Itinerary engine public API (backlog item 1). Pure TypeScript; reads
 * flights only through a FlightDataProvider.
 */
export { AIRPORTS, AREA_TABLE, areaFor, endAirports, transferMin, type Area } from './airports';
export { createMemoryProvider } from './memoryProvider';
export { createSampleProvider } from './sample/sampleProvider';
export {
  DEFAULT_SEARCH_OPTIONS,
  KEEP_LEFT,
  MAX_DAYS_OUT,
  compareItineraries,
  pickResults,
  searchItineraries,
  searchRoutes,
} from './search';
export { legSeats, routeTier, tierForNetSeats, tierRank } from './seats';
export { addDays, localDate, zonedToUtc } from './time';
export { toRouteLine } from './toRouteLine';
export type * from './types';
