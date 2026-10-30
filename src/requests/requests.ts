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

/** Sample flights leaving between `startMs` and `endMs` from now (negative = already left), earliest first. */
export function sampleFlightsBetween(now: number, startMs: number, endMs: number): Flight[] {
  const out: Flight[] = [];
  const today = localDate(now, 'America/Chicago');
  for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
    for (const [airline, flightNumber, from, to, time, blockMin] of SAMPLE_SCHEDULE) {
      const departUtc = zonedToUtc(date, time, AIRPORTS[from].tz);
      if (departUtc < now + startMs || departUtc > now + endMs) continue;
      const id = `${airline}${flightNumber}-${date}-${from}`;
      out.push({ id, airline, flightNumber, from, to, departUtc, arriveUtc: departUtc + blockMin * 60_000 });
    }
  }
  return out.sort((a, b) => a.departUtc - b.departUtc);
}

/** Sample flights leaving between 40 minutes and 30 hours from now. */
const upcomingSampleFlights = (now: number) => sampleFlightsBetween(now, 40 * 60_000, 30 * 3600_000);

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
/** `atUtc`: a live delayed time to show instead of the schedule (round 50). */
export function departsText(f: Flight, now: number, atUtc: number = f.departUtc): string {
  const tz = AIRPORTS[f.from].tz;
  const day = localDate(atUtc, tz) === localDate(now, tz) ? '' : 'tomorrow ';
  return `Departs ${day}${formatTime(atUtc, tz)}`;
}

/** "Likely · 18 open · 3 listed": tier word with both numbers (Q-065). */
export const answerText = (a: LoadAnswer) => `${TIER_WORD[answerTier(a)]} · ${a.open} open · ${a.listed} listed`;

/** Second line of a request row. */
export function requestDetail(r: LoadRequest, now: number): string {
  if (r.answer) return `${answerText(r.answer)} · ${r.answer.byYou ? 'you answered' : 'answered'} ${formatAge(r.answer.at, now)}`;
  return `${departsText(r.flight, now)} · asked ${formatAge(r.askedAt, now)}`;
}

/** The live state a waiting request's detail line follows (round 50). */
export interface RequestLive {
  kind: 'delayed' | 'departed' | 'arrived' | 'canceled' | 'diverted';
  scheduledText: string;
  newUtc: number | null;
}

/** A waiting request's detail line, split so the row can style the time that matters now. */
export interface LiveRequestDetail {
  /** Muted words before the time: "Departs ", "Departs tomorrow ", "Scheduled ". */
  prefix: string;
  /** The time that matters now, in full text color; null when there is none (canceled). */
  time: string | null;
  /** The scheduled time, small and struck after it (delayed, canceled). */
  struck: string | null;
  /** " · asked 20m ago" */
  tail: string;
  spoken: string;
}

const nb = (s: string) => s.replace(/ /g, '\u00a0');

/**
 * Lead with what matters now (John, 2026-10-30): a delay shows the new time
 * with the scheduled one struck after it; a canceled flight strikes the time;
 * a flight that left says Scheduled, not a future "Departs". Null: no change.
 */
export function liveRequestDetail(r: LoadRequest, now: number, live: RequestLive | null): LiveRequestDetail | null {
  if (!live || r.answer) return null;
  const asked = formatAge(r.askedAt, now);
  const tail = ` · asked\u00a0${nb(asked)}`;
  const tz = AIRPORTS[r.flight.from].tz;
  switch (live.kind) {
    case 'delayed': {
      if (live.newUtc == null) return null;
      const lead = departsText(r.flight, now, live.newUtc);
      const time = formatTime(live.newUtc, tz);
      return {
        prefix: `${lead.slice(0, lead.length - time.length)}`,
        time: nb(time),
        struck: nb(live.scheduledText),
        tail,
        spoken: `${lead}, scheduled ${live.scheduledText}, asked ${asked}`,
      };
    }
    case 'canceled':
    case 'diverted':
      // The tag says "Canceled, was 2:15 PM", so speech only adds when it was asked.
      return { prefix: 'Scheduled ', time: null, struck: nb(live.scheduledText), tail, spoken: `asked ${asked}` };
    case 'departed':
    case 'arrived':
      return {
        prefix: 'Scheduled ',
        time: nb(live.scheduledText),
        struck: null,
        tail,
        spoken: `Scheduled ${live.scheduledText}, asked ${asked}`,
      };
  }
}

/** Clamp a report field to its range (whole numbers). */
export function clampReport(field: 'open' | 'listed', value: number): number {
  const max = field === 'open' ? MAX_OPEN : MAX_LISTED;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

/** "6 seats after the standby list", or "No seats after the standby list". */
export function afterListText(open: number, listed: number): string {
  const net = open - listed;
  if (net <= 0) return 'No seats after the standby list';
  return `${net} ${net === 1 ? 'seat' : 'seats'} after the standby list`;
}

/** Reports open 7 days before departure and close 2 hours after (DECISIONS.md). */
export const REPORT_OPENS_BEFORE_MS = 7 * 24 * 3600_000;
export const REPORT_CLOSES_AFTER_MS = 2 * 3600_000;

/** early: more than 7 days out; open: can report; closed: left over 2 hours ago. */
export type ReportWindow = 'early' | 'open' | 'closed';

export function reportWindow(f: Flight, now: number): ReportWindow {
  if (now < f.departUtc - REPORT_OPENS_BEFORE_MS) return 'early';
  if (now > f.departUtc + REPORT_CLOSES_AFTER_MS) return 'closed';
  return 'open';
}

/** Whether a flight can take a report now. */
export const inReportWindow = (f: Flight, now: number) => reportWindow(f, now) === 'open';

/** Why Report Load is off, or null when it's on. */
export function reportClosedNote(w: ReportWindow): string | null {
  if (w === 'early') return 'Reports open 7 days before departure.';
  if (w === 'closed') return 'Reports closed 2 hours after this flight left.';
  return null;
}

/** One flight on one day, whichever list it came from. */
export const flightKey = (f: Flight) => `${f.airline}${f.flightNumber}-${f.from}-${f.departUtc}`;

/** Asks still waiting for an answer. */
export const openRequestCount = (mine: LoadRequest[]) => mine.filter((r) => !r.answer).length;

/** ready: can ask; asked: already asked about this flight; full: 5 asks still waiting; left: the flight has gone. */
export type AskState = 'ready' | 'asked' | 'full' | 'left';

export function askState(mine: LoadRequest[], flight: Flight, now: number): AskState {
  const key = flightKey(flight);
  if (mine.some((r) => flightKey(r.flight) === key)) return 'asked';
  if (flight.departUtc <= now) return 'left';
  if (openRequestCount(mine) >= MAX_OPEN_REQUESTS) return 'full';
  return 'ready';
}

/** Your asks with a new one on top, or unchanged when you can't ask. */
export function addAsk(mine: LoadRequest[], flight: Flight, now: number): LoadRequest[] {
  if (askState(mine, flight, now) !== 'ready') return mine;
  return [{ id: `mine-${flightKey(flight)}`, flight, askedAt: now }, ...mine];
}

/** Your ask on this flight, if any. */
export const askFor = (mine: LoadRequest[], flight: Flight) => {
  const key = flightKey(flight);
  return mine.find((r) => flightKey(r.flight) === key) ?? null;
};

/** Take back an ask still waiting (frees one of the 5); an answered one stays. */
export function cancelAsk(mine: LoadRequest[], flight: Flight): LoadRequest[] {
  const key = flightKey(flight);
  const next = mine.filter((r) => r.answer || flightKey(r.flight) !== key);
  return next.length === mine.length ? mine : next;
}

/** The line under Ask for Load. */
export function askNote(state: AskState): string {
  if (state === 'asked') return 'Asked. The answer shows in My Trips.';
  if (state === 'left') return 'This flight has left, so there’s no one to ask.';
  if (state === 'full') return `You have ${MAX_OPEN_REQUESTS} requests waiting. Ask again once one is answered.`;
  return 'Ask other employees who fly this airline. They won’t see who asked.';
}
