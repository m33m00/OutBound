/**
 * Load requests (DECISIONS.md "Reports and requests"): someone asks how a
 * flight looks; someone at that flight's airline answers with open seats and
 * nonrevs listed. Anonymous to other users. Max 5 open asks per person.
 *
 * Until the requests backend exists, Feed and My Trips show example requests
 * built from the sample schedule (design round 30/31, John: "I really just
 * want an idea of what this app will look like"). Answers you give stay on
 * this screen only.
 */
import { addDays, AIRPORTS, localDate, tierForNetSeats, zonedToUtc, type Flight, type SeatTier } from '@/engine';
import { SAMPLE_SCHEDULE } from '@/engine/sample/schedule';
import { formatAge, formatTime, TIER_WORD } from '@/search/format';

/** Max open asks per person (DECISIONS.md). */
export const MAX_OPEN_REQUESTS = 5;
/** Nonrevs listed: 0-250 (DECISIONS.md). */
export const MAX_LISTED = 250;
/**
 * Open seats ceiling. DECISIONS.md says "seats ≤ capacity", but there is no
 * aircraft capacity data yet; 200 covers every narrowbody (provisional).
 */
export const MAX_OPEN = 200;

export interface LoadAnswer {
  open: number;
  listed: number;
  at: number;
  /** You answered it (Feed), as opposed to someone at the airline (My Trips). */
  byYou?: boolean;
}

export interface LoadRequest {
  id: string;
  flight: Flight;
  askedAt: number;
  answer?: LoadAnswer;
}

/** The person's airline until accounts exist (prototype default; provisional). */
export const SAMPLE_MY_AIRLINE = 'WN';

/** Small deterministic hash so example requests stay put between renders. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Sample flights leaving between 40 minutes and 30 hours from now, earliest first. */
function upcomingSampleFlights(now: number): Flight[] {
  const out: Flight[] = [];
  const today = localDate(now, 'America/Chicago');
  for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
    for (const [airline, flightNumber, from, to, time, blockMin] of SAMPLE_SCHEDULE) {
      const departUtc = zonedToUtc(date, time, AIRPORTS[from].tz);
      if (departUtc < now + 40 * 60_000 || departUtc > now + 30 * 3600_000) continue;
      const id = `${airline}${flightNumber}-${date}-${from}`;
      out.push({ id, airline, flightNumber, from, to, departUtc, arriveUtc: departUtc + blockMin * 60_000 });
    }
  }
  return out.sort((a, b) => a.departUtc - b.departUtc);
}

/** Minutes ago, stable per flight: between `min` and `min + span`. */
const askedAgo = (id: string, min: number, span: number) => (min + (hash(id) % span)) * 60_000;

/**
 * Feed: open asks about your airline's flights, newest ask first (DECISIONS.md:
 * the feed shows only your airline plus your own asks; yours live in My Trips).
 */
export function sampleFeed(now: number, airline = SAMPLE_MY_AIRLINE, count = 4): LoadRequest[] {
  return upcomingSampleFlights(now)
    .filter((f) => f.airline === airline)
    .slice(0, count)
    .map((flight) => ({ id: `req-${flight.id}`, flight, askedAt: now - askedAgo(flight.id, 3, 90) }))
    .sort((a, b) => b.askedAt - a.askedAt);
}

/**
 * My Trips: your own asks on other airlines' flights. The sooner flight has
 * been answered, the other is still waiting, so both looks show.
 */
export function sampleMine(now: number, airline = SAMPLE_MY_AIRLINE): LoadRequest[] {
  const others = upcomingSampleFlights(now).filter((f) => f.airline !== airline);
  const picks = [others[1], others[Math.min(others.length - 1, 6)]].filter(
    (f, i, all): f is Flight => f != null && all.indexOf(f) === i,
  );
  return picks.map((flight, i) => {
    const h = hash(flight.id);
    const askedAt = now - askedAgo(flight.id, 20, 60);
    const req: LoadRequest = { id: `mine-${flight.id}`, flight, askedAt };
    if (i === 0) req.answer = { open: 12 + (h % 30), listed: (h >>> 5) % 9, at: askedAt + 9 * 60_000 };
    return req;
  });
}

/** Net seats' tier: what the open seats leave after the standby list. */
export const answerTier = (a: Pick<LoadAnswer, 'open' | 'listed'>): SeatTier => tierForNetSeats(a.open - a.listed);

/** "WN 1720 · DAL → LAX". */
export const requestTitle = (r: LoadRequest) =>
  `${r.flight.airline} ${r.flight.flightNumber} · ${r.flight.from} → ${r.flight.to}`;

/** "Departs 10:55 AM", local at the origin; "Departs tomorrow 7:30 AM" for the next day there. */
export function departsText(f: Flight, now: number): string {
  const tz = AIRPORTS[f.from].tz;
  const day = localDate(f.departUtc, tz) === localDate(now, tz) ? '' : 'tomorrow ';
  return `Departs ${day}${formatTime(f.departUtc, tz)}`;
}

/** "Good · 18 open · 3 listed": tier word with both numbers (Q-065). */
export const answerText = (a: LoadAnswer) => `${TIER_WORD[answerTier(a)]} · ${a.open} open · ${a.listed} listed`;

/** Second line of a request row. */
export function requestDetail(r: LoadRequest, now: number): string {
  if (r.answer) return `${answerText(r.answer)} · ${r.answer.byYou ? 'you answered' : 'answered'} ${formatAge(r.answer.at, now)}`;
  return `${departsText(r.flight, now)} · asked ${formatAge(r.askedAt, now)}`;
}

/** Clamp a report field to its range (whole numbers). */
export function clampReport(field: 'open' | 'listed', value: number): number {
  const max = field === 'open' ? MAX_OPEN : MAX_LISTED;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

/** "6 seats after the list", or "No seats after the list". */
export function afterListText(open: number, listed: number): string {
  const net = open - listed;
  if (net <= 0) return 'No seats after the list';
  return `${net} ${net === 1 ? 'seat' : 'seats'} after the list`;
}
