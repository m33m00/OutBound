/**
 * Itinerary engine types. Rules come from DECISIONS.md "Search" and
 * "Seat availability"; provisional defaults are marked and tracked in
 * design/QUESTIONS.md (Q-012, Q-013).
 *
 * All times are UTC epoch milliseconds. Local time is for display only.
 */
import type { LineSource, SeatTier } from '@/map';

export type { LineSource, SeatTier };

export interface Airport {
  /** IATA code, e.g. "DFW". */
  code: string;
  name: string;
  lon: number;
  lat: number;
  /** IANA time zone, e.g. "America/Chicago". */
  tz: string;
}

/** One scheduled flight leg. */
export interface Flight {
  /** Stable id, unique per departure (airline + number + date + origin). */
  id: string;
  /** IATA airline code only (no names or logos). */
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departUtc: number;
  arriveUtc: number;
}

/** Seat data source a provider can hold. 'unknown' means none of these. */
export type SeatSource = Exclude<LineSource, 'unknown'>;

/** One seat reading for a flight, from one source. */
export interface SeatReport {
  source: SeatSource;
  openSeats: number;
  /** Nonrevs listed. */
  listed: number;
  /** When this value was observed. Every value shows its age. */
  asOf: number;
}

/**
 * Where flights and seats come from. Today: sample data. Later: our own
 * schedule DB (daily AeroDataBox pulls). Never a live call per search.
 */
export interface FlightDataProvider {
  /** Flights departing `airport` with departUtc in [fromUtc, toUtc). */
  getDepartures(airport: string, fromUtc: number, toUtc: number): Promise<Flight[]>;
  /** Every seat reading held for a flight, any order. Empty if none. */
  getSeatReports(flightId: string): Promise<SeatReport[]>;
  /** Airport table (codes, coordinates, time zones). */
  getAirport(code: string): Airport | undefined;
}

/** Seat picture for one leg after picking the best source. */
export interface LegSeats {
  source: LineSource;
  /** 'unknown' for typical loads (neutral) and when there is no data. */
  tier: SeatTier;
  /** open - listed; null when unknown. Typical loads keep their number. */
  netSeats: number | null;
  asOf: number | null;
}

export interface ItineraryLeg {
  flight: Flight;
  seats: LegSeats;
}

export interface Connection {
  airport: string;
  layoverMin: number;
  sameAirline: boolean;
}

export interface Itinerary {
  /** Flight ids joined by '+'. Also the map RouteLine id. */
  id: string;
  /** Airport codes joined by '>', e.g. "BNA>DFW>LAX". Groups options on one path. */
  pathKey: string;
  legs: ItineraryLeg[];
  stops: number;
  /** Connection airports in order (weather badges use these for connections). */
  connections: Connection[];
  departUtc: number;
  arriveUtc: number;
  totalMin: number;
  /** What the user asked for vs. what this route uses (area airports, Q-048). */
  requestedOrigin: string;
  requestedDestination: string;
  origin: string;
  destination: string;
  /**
   * Ground transfer minutes at each end; 0 when the requested airport is
   * used, null when the pair has no transfer data yet.
   */
  originTransferMin: number | null;
  destinationTransferMin: number | null;
  /** Weakest reported/estimate leg; 'unknown' if none. */
  tier: SeatTier;
  /** Any leg Full. Full routes stay in time order, shown grayed. */
  isFull: boolean;
}

/** Search results plus what explains an empty list (Q-047). */
export interface SearchOutcome {
  /** Top routes under the filters in use. */
  results: Itinerary[];
  /**
   * Only when `results` is empty: routes the filters hid (found with the
   * loosest filters). 0 = the market has no flights that day.
   */
  hiddenCount: number;
  /** Top hidden routes, for "Show Them" (this search only). */
  hiddenResults: Itinerary[];
}

export interface SearchRequest {
  origin: string;
  destination: string;
  /** Local calendar date at the origin, "YYYY-MM-DD", 0-7 days out. */
  date: string;
  /** Area toggle (Q-048): search every airport in the origin's area. Default off. */
  originArea?: boolean;
  /** Same for the destination. Get Home always turns it on. */
  destinationArea?: boolean;
}

export interface SearchOptions {
  /** 0-3, default 3. */
  maxStops: number;
  /** Minimum connection, same airline. Default 60. */
  minConnectSameAirlineMin: number;
  /** Minimum connection, switching airlines. Default 90. */
  minConnectSwitchMin: number;
  /** Maximum layover. Default 240. */
  maxLayoverMin: number;
  /** Provisional: max first departure to last arrival. Default 24h. */
  maxTripMin: number;
  /** Results returned. Default 10 (top 10 routes). */
  limit: number;
  /** Clock, injectable for tests. Default Date.now(). */
  now: number;
}
