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

/** "1 hour 20 minutes" for VoiceOver, which can read "20m" as meters. */
export function spokenDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '';
  const mins = m || !h ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '';
  return [hs, mins].filter(Boolean).join(' ');
}

const plural = (n: string, unit: string) => `${n} ${unit}${n === '1' ? '' : 's'}`;

/**
 * Visible shorthand turned into words for VoiceOver (design round 26): "·" becomes a
 * pause, "→" "to", "~" "about", "est." "estimated", and "4m ago" "4 minutes ago".
 */
export function forSpeech(text: string): string {
  return text
    .replace(/ · /g, ', ')
    .replace(/ → /g, ' to ')
    .replace(/~/g, 'about ')
    .replace(/\best\./gi, (m) => (m[0] === 'E' ? 'Estimated' : 'estimated'))
    .replace(/\b(\d+)m ago\b/g, (_, n: string) => `${plural(n, 'minute')} ago`)
    .replace(/\b(\d+)h ago\b/g, (_, n: string) => `${plural(n, 'hour')} ago`)
    .replace(/\b(\d+)d ago\b/g, (_, n: string) => `${plural(n, 'day')} ago`);
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

/** Seat labels say your chances of getting on (Q-074, John 2026-10-30). */
export const TIER_WORD: Record<SeatTier, string> = {
  wide: 'Easy',
  good: 'Likely',
  okay: 'Maybe',
  tight: 'Long\u00a0shot',
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
    const month = seats.asOf == null ? '' : ` · ${MONTHS[new Date(seats.asOf).getUTCMonth()]} avg`;
    return `Usually ~${Math.max(0, seats.netSeats)} open${month}`;
  }
  const open = seatCounts(seats);
  const age = seats.asOf == null ? '' : ` · ${seats.source === 'reported' ? 'reported' : 'est.'} ${formatAge(seats.asOf, now)}`;
  return `${TIER_WORD[seats.tier]} · ${open}${age}`;
}

/**
 * Route seat summary for the row's top line (Q-059): the route's chance word, e.g. "Long shot".
 * Cards show just the word; the open and listed numbers are in the flight's sheet
 * (John, 2026-10-31). Null when no leg has reported or estimated seats (typical loads stay neutral).
 */
export function routeSeatSummary(it: Itinerary): string | null {
  if (it.tier === 'unknown') return null;
  return TIER_WORD[it.tier];
}

/**
 * Both numbers behind the tier (Q-065, John 2026-10-30): "20 open · 17 listed".
 * A reading without them (older data) falls back to the net count, "3 open".
 */
export function seatCounts(seats: LegSeats): string {
  if (seats.openSeats != null && seats.listed != null) return `${seats.openSeats} open · ${seats.listed} listed`;
  const net = seats.netSeats ?? 0;
  return net > 0 ? `${net} open` : 'no open seats';
}

/** The leg that sets the route tier (fewest open seats among the weakest-tier legs); null when Unknown. */
export function weakestLeg(it: Itinerary): Itinerary['legs'][number] | null {
  if (it.tier === 'unknown') return null;
  const legs = it.legs.filter((l) => l.seats.tier === it.tier);
  if (!legs.length) return null;
  return legs.reduce((a, b) => ((b.seats.netSeats ?? Infinity) < (a.seats.netSeats ?? Infinity) ? b : a));
}

/** Age of the route seat summary, from the leg that sets it: "Reported 5m ago". */
export function routeSeatAge(it: Itinerary, now: number): string | null {
  const leg = weakestLeg(it);
  return leg ? seatSourceText(leg.seats, now) : null;
}

/**
 * Neutral seat line when a route has no counted tier (only typical loads or no
 * data): the tightest typical leg, e.g. "Usually ~51 open · Jul avg", else "No data yet".
 */
export function neutralSeatText(it: Itinerary, now: number): string {
  const typical = it.legs.filter((l) => l.seats.source === 'typical' && l.seats.netSeats != null);
  if (!typical.length) return 'No data yet';
  const least = typical.reduce((a, b) => ((b.seats.netSeats as number) < (a.seats.netSeats as number) ? b : a));
  return seatText(least.seats, now);
}

/** Connections shorter than this show their length on the slim row. */
export const SHORT_LAYOVER_MIN = 60;

/** Slim row stops: "Nonstop", "1 stop", or "1 stop · 45m at DEN" when a connection is short. */
export function slimStops(it: Itinerary): string {
  const short = it.connections.filter((c) => c.layoverMin < SHORT_LAYOVER_MIN);
  return [stopCount(it), ...short.map((c) => `${formatDuration(c.layoverMin)} at ${c.airport}`)].join(' · ');
}

/** Where a leg's seat number came from and its age: "Reported 5m ago", "Est. 2h ago". */
export function seatSourceText(seats: LegSeats, now: number): string | null {
  if (seats.asOf == null || (seats.source !== 'reported' && seats.source !== 'estimate')) return null;
  return `${seats.source === 'reported' ? 'Reported' : 'Est.'} ${formatAge(seats.asOf, now)}`;
}

/** "Nonstop", "1 stop", "2 stops". */
export function stopCount(it: Itinerary): string {
  return it.stops ? `${it.stops} ${it.stops === 1 ? 'stop' : 'stops'}` : 'Nonstop';
}

/** "Nonstop", "1 stop · DEN", "2 stops · DEN, ORD". */
export function stopsText(it: Itinerary): string {
  if (!it.stops) return 'Nonstop';
  return `${stopCount(it)} · ${it.connections.map((c) => c.airport).join(', ')}`;
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
    spokenDuration(it.totalMin),
    it.isFull ? 'Full route' : `Chances: ${TIER_WORD[it.tier]}`,
    ...it.legs.map((l) => `${l.flight.airline} ${l.flight.flightNumber}: ${forSpeech(seatText(l.seats, now))}`),
    ...nearbyNotes(it),
  ];
  return parts.join(', ');
}
