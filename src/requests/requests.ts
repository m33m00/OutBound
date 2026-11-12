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
import { sampleAircraft } from '@/engine/aircraft';
import { SAMPLE_SCHEDULE } from '@/engine/sample/schedule';
import { formatAge, formatTime, seatPair } from '@/search/format';

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
  /** The connecting route this leg was requested from, so My Trips keeps its legs together (round 194). */
  route?: RequestRoute;
}

/** A connecting route a request belongs to: its search id and title, e.g. "DAL to DEN to LAX". */
export interface RequestRoute {
  id: string;
  title: string;
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
      const aircraft = sampleAircraft(airline, flightNumber, blockMin);
      out.push({
        id,
        airline,
        flightNumber,
        from,
        to,
        departUtc,
        arriveUtc: departUtc + blockMin * 60_000,
        ...(aircraft ? { aircraft } : {}),
      });
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
  return (
    upcomingSampleFlights(now)
      .filter((f) => f.airline === airline)
      .slice(0, count)
      .map((flight) => ({ id: `req-${flight.id}`, flight, askedAt: now - askedAgo(flight.id, 3, 90) }))
      // Oldest ask on top, so the one waiting longest gets answered first (round 167, John).
      .sort((a, b) => a.askedAt - b.askedAt)
  );
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

/** "18 seats · 3 listed": both numbers (Q-065; no "open", round 138; no tier word, round 140). */
// Just the numbers since round 140; the color says the rest.
export const answerText = (a: LoadAnswer) => seatPair(a.open, a.listed);

/** "you answered 2m ago": the part of an answered row after its numbers (round 164). */
export const answeredAgo = (a: LoadAnswer, now: number) => `${a.byYou ? 'you answered' : 'answered'} ${formatAge(a.at, now)}`;

/** Second line of a request row. */
export function requestDetail(r: LoadRequest, now: number): string {
  if (r.answer) return `${answerText(r.answer)} · ${answeredAgo(r.answer, now)}`;
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
      // The tag says "Canceled, was 2:15 PM", so speech only adds when it was asked.
      return { prefix: 'Scheduled ', time: null, struck: nb(live.scheduledText), tail, spoken: `asked ${asked}` };
    // A diverted flight left on its time and goes on late; its departure isn't struck (John, 2026-11-01).
    case 'diverted':
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

/** Asks still waiting for an answer; with `now`, only for flights that haven't left (they drop off at departure). */
export const openRequestCount = (mine: LoadRequest[], now?: number) =>
  mine.filter((r) => !r.answer && (now == null || r.flight.departUtc > now)).length;

/**
 * Your asks for flights still to leave, soonest first (John, 2026-11-02: nothing that departed or
 * arrived). Each drops off at its departure time; `gone` drops one live data says already left.
 */
/** How long an answered ask stays in My Trips after its flight lands (round 167, John). */
export const ANSWERED_KEEP_MS = 24 * 60 * 60_000;

/**
 * Your asks still worth showing, soonest flight first. One still waiting goes once its flight leaves (no one
 * can answer it then); an answered one stays until 24 hours after its flight lands (round 167, John).
 */
export function upcomingRequests(mine: LoadRequest[], now: number, gone?: (r: LoadRequest) => boolean): LoadRequest[] {
  return mine
    .filter((r) => (r.answer ? r.flight.arriveUtc + ANSWERED_KEEP_MS > now : r.flight.departUtc > now && !gone?.(r)))
    .sort((a, b) => a.flight.departUtc - b.flight.departUtc);
}

/** The departure line of an ask without when it was asked, which the row shows on its own (round 167). */
export const requestDepartsLine = (r: LoadRequest, now: number) => departsText(r.flight, now);

/** ready: can ask; asked: already asked about this flight; full: 5 asks still waiting; left: the flight has gone. */
export type AskState = 'ready' | 'asked' | 'full' | 'left';

export function askState(mine: LoadRequest[], flight: Flight, now: number): AskState {
  const key = flightKey(flight);
  if (mine.some((r) => flightKey(r.flight) === key)) return 'asked';
  if (flight.departUtc <= now) return 'left';
  if (openRequestCount(mine, now) >= MAX_OPEN_REQUESTS) return 'full';
  return 'ready';
}

/** Your asks with a new one on top, or unchanged when you can't ask. */
export function addAsk(mine: LoadRequest[], flight: Flight, now: number): LoadRequest[] {
  if (askState(mine, flight, now) !== 'ready') return mine;
  return [{ id: `mine-${flightKey(flight)}`, flight, askedAt: now }, ...mine];
}

/** Ids of your asks that have an answer. */
export const answeredIds = (mine: LoadRequest[]): string[] => mine.filter((r) => r.answer).map((r) => r.id);

/** Asks answered since `seen` (round 181: the yaoom plays once for these). */
export const newlyAnswered = (seen: ReadonlySet<string>, mine: LoadRequest[]): string[] =>
  answeredIds(mine).filter((id) => !seen.has(id));

/** Your asks with this flight's answer in (round 176 demo): an ask already there gets the answer. */
export function addAnsweredAsk(mine: LoadRequest[], flight: Flight, answer: LoadAnswer, route?: RequestRoute): LoadRequest[] {
  const key = flightKey(flight);
  if (mine.some((r) => flightKey(r.flight) === key))
    return mine.map((r) =>
      flightKey(r.flight) === key && !r.answer ? { ...r, answer, ...(route && !r.route ? { route } : {}) } : r,
    );
  return [{ id: `mine-${key}`, flight, askedAt: answer.at, answer, ...(route ? { route } : {}) }, ...mine];
}

/** A requested route's heading in My Trips, e.g. "DAL to DEN to LAX, 2 legs" (round 194). */
export const routeHeading = (title: string, legs: number) => `${title}, ${legs} ${legs === 1 ? 'leg' : 'legs'}`;

/** A block in My Trips' requests: one connecting route's legs together, or a lone flight. */
export interface RequestGroup {
  key: string;
  route: RequestRoute | null;
  requests: LoadRequest[];
}

/**
 * Requests grouped by the route they were asked from (round 194, John: "When I request a route and I go to my
 * trips. Can you group that route and not treat them as single flights. If I start to request alot of routes its
 * easier to keep track"). A route's legs stay together in flight order; blocks go by their first departure. A
 * flight asked on its own, or a route with only one leg left to show, stays a single row.
 */
export function groupRequests(requests: readonly LoadRequest[]): RequestGroup[] {
  const byRoute = new Map<string, LoadRequest[]>();
  for (const r of requests) if (r.route) byRoute.set(r.route.id, [...(byRoute.get(r.route.id) ?? []), r]);
  const groups: RequestGroup[] = [];
  const seen = new Set<string>();
  for (const r of requests) {
    const legs = r.route ? byRoute.get(r.route.id)! : null;
    if (r.route && legs && legs.length > 1) {
      if (seen.has(r.route.id)) continue;
      seen.add(r.route.id);
      groups.push({
        key: `route-${r.route.id}`,
        route: r.route,
        requests: [...legs].sort((a, b) => a.flight.departUtc - b.flight.departUtc),
      });
    } else groups.push({ key: r.id, route: null, requests: [r] });
  }
  return groups.sort((a, b) => a.requests[0].flight.departUtc - b.requests[0].flight.departUtc);
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
  return 'Ask employees at this airline. They won’t see who asked.';
}
