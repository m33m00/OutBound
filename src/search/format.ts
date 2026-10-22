/**
 * Text for search and results. Pure functions so rows and their
 * accessibility labels read the same and are unit tested.
 */
import { AIRPORTS, localDate, type Airport, type Itinerary, type LegSeats, type SeatTier } from '@/engine';

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/** Local clock time at an airport, e.g. "7:05 AM". */
export function formatTime(utc: number, tz: string): string {
  let f = timeFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
    timeFormatters.set(tz, f);
  }
  return f.format(new Date(utc));
}

/** Whole local days between two instants at their own airports ("+1" on rows). */
export function dayShift(fromUtc: number, fromTz: string, toUtc: number, toTz: string): number {
  const a = localDate(fromUtc, fromTz);
  const b = localDate(toUtc, toTz);
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** "2h 15m", "45m", "3h". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Every value shows its age: "just now", "12m ago", "3h ago", "2d ago". */
export function formatAge(asOf: number, now: number): string {
  const min = Math.max(0, Math.floor((now - asOf) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const TIER_WORD: Record<SeatTier, string> = {
  wide: 'Wide open',
  good: 'Good',
  okay: 'Okay',
  tight: 'Tight',
  full: 'Full',
  unknown: 'Unknown',
};

/**
 * One leg's seat text. Tier word always appears with its number (color is
 * never the only signal). Typical loads are neutral: no tier word.
 */
export function seatText(seats: LegSeats, now: number): string {
  if (seats.source === 'unknown' || seats.netSeats == null) return 'No data yet';
  if (seats.source === 'typical') {
    // Typical loads are monthly averages: their age is the data month.
    const month = seats.asOf == null ? '' : ` · ${MONTHS[new Date(seats.asOf).getUTCMonth()]} data`;
    return `Typically ~${Math.max(0, seats.netSeats)} open${month}`;
  }
  const open = seats.netSeats > 0 ? `${seats.netSeats} open` : 'no open seats';
  const age = seats.asOf == null ? '' : ` · ${seats.source === 'reported' ? 'reported' : 'est.'} ${formatAge(seats.asOf, now)}`;
  return `${TIER_WORD[seats.tier]} · ${open}${age}`;
}

/** "Nonstop", "1 stop · DEN", "2 stops · DEN, ORD". */
export function stopsText(it: Itinerary): string {
  if (!it.stops) return 'Nonstop';
  const where = it.connections.map((c) => c.airport).join(', ');
  return `${it.stops} ${it.stops === 1 ? 'stop' : 'stops'} · ${where}`;
}

/** "35 min from DFW", or "near DFW" when the transfer time is unknown. */
const fromText = (min: number | null, code: string) => (min == null ? `near ${code}` : `${min} min from ${code}`);

/** Area-airport notes, e.g. "Leaves from DAL, 35 min from DFW". */
export function nearbyNotes(it: Itinerary): string[] {
  const notes: string[] = [];
  if (it.origin !== it.requestedOrigin) {
    notes.push(`Leaves from ${it.origin}, ${fromText(it.originTransferMin, it.requestedOrigin)}`);
  }
  if (it.destination !== it.requestedDestination) {
    notes.push(`Arrives at ${it.destination}, ${fromText(it.destinationTransferMin, it.requestedDestination)}`);
  }
  return notes;
}

function airport(code: string): Airport {
  const a = AIRPORTS[code];
  if (!a) throw new RangeError(`Unknown airport ${code}`);
  return a;
}

export interface RowTimes {
  depart: string;
  arrive: string;
  /** "+1" when arrival is on a later local day, else "". */
  plusDays: string;
}

export function rowTimes(it: Itinerary): RowTimes {
  const from = airport(it.origin);
  const to = airport(it.destination);
  const shift = dayShift(it.departUtc, from.tz, it.arriveUtc, to.tz);
  return {
    depart: formatTime(it.departUtc, from.tz),
    arrive: formatTime(it.arriveUtc, to.tz),
    plusDays: shift > 0 ? `+${shift}` : '',
  };
}

/** What VoiceOver reads for a whole result row. */
export function rowAccessibilityLabel(it: Itinerary, now: number): string {
  const t = rowTimes(it);
  const parts = [
    `Departs ${t.depart} from ${it.origin}`,
    `arrives ${t.arrive}${t.plusDays ? ' next day' : ''} at ${it.destination}`,
    stopsText(it).replace(' · ', ' via '),
    formatDuration(it.totalMin),
    it.isFull ? 'Full route' : `Route ${TIER_WORD[it.tier]}`,
    ...it.legs.map((l) => `${l.flight.airline} ${l.flight.flightNumber}: ${seatText(l.seats, now).replace(/ · /g, ', ')}`),
    ...nearbyNotes(it),
  ];
  return parts.join(', ');
}
