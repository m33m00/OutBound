/**
 * Itinerary engine public API (backlog item 1). Pure TypeScript; reads
 * flights only through a FlightDataProvider.
 */
export { AIRPORTS, NEARBY_GROUPS, airportsNear, type NearbyGroup } from './airports';
export { createMemoryProvider } from './memoryProvider';
export { createSampleProvider } from './sample/sampleProvider';
export { DEFAULT_SEARCH_OPTIONS, MAX_DAYS_OUT, compareItineraries, searchItineraries } from './search';
export { legSeats, routeTier, tierForNetSeats, tierRank } from './seats';
export { localDate, zonedToUtc } from './time';
export { toRouteLine } from './toRouteLine';
export type * from './types';
