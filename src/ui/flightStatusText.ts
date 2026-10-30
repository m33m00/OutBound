import type { FlightState, FlightStatusResponse, Movement } from '@/live';
import type { FlightStatusEntry } from '@/live/flightStatus';
import { formatAge, formatTime } from '@/search/format';

export const STATE_WORD: Record<FlightState, string> = {
  scheduled: 'On time',
  delayed: 'Delayed',
  // Matches the row tag (Q-050): pushed back may still be taxiing.
  departed: 'Departed',
  arrived: 'Arrived',
  canceled: 'Canceled',
  diverted: 'Diverted',
};

/** "50 min late", "4 min early", "On time"; null when unknown. */
export function delayText(min: number | null): string | null {
  if (min == null) return null;
  if (Math.abs(min) < 5) return 'On time';
  return min > 0 ? `${min} min late` : `${-min} min early`;
}

/** Best time to show: actual, else estimated, else scheduled. */
export function bestTime(m: Movement): { label: 'Actual' | 'Estimated' | 'Scheduled'; ms: number } | null {
  if (m.actualUtc) return { label: 'Actual', ms: Date.parse(m.actualUtc) };
  if (m.estimatedUtc) return { label: 'Estimated', ms: Date.parse(m.estimatedUtc) };
  if (m.scheduledUtc) return { label: 'Scheduled', ms: Date.parse(m.scheduledUtc) };
  return null;
}

/** "Scheduled 2:00 PM · Estimated 2:50 PM" at the airport's local time. */
export function movementTimes(m: Movement, tz: string): string {
  const parts: string[] = [];
  if (m.scheduledUtc) parts.push(`Scheduled ${formatTime(Date.parse(m.scheduledUtc), tz)}`);
  const b = bestTime(m);
  if (b && b.label !== 'Scheduled') parts.push(`${b.label} ${formatTime(b.ms, tz)}`);
  return parts.join(' · ');
}

/**
 * The time that matters now and the one it replaced (John, 2026-10-30: lead with now, not with the schedule).
 * `was` is the scheduled time only when the shown time differs from it by a minute or more.
 */
export function movementLead(m: Movement, tz: string): { time: string; label: string; was: string | null } | null {
  const b = bestTime(m);
  if (!b) return null;
  const sched = m.scheduledUtc ? Date.parse(m.scheduledUtc) : NaN;
  const moved = b.label !== 'Scheduled' && Number.isFinite(sched) && Math.abs(b.ms - sched) >= 60_000;
  return { time: formatTime(b.ms, tz), label: b.label, was: moved ? formatTime(sched, tz) : null };
}

/** For VoiceOver, in the order the card shows it: "Estimated 2:40 PM, scheduled 2:15 PM". */
export function movementSpoken(m: Movement, tz: string): string {
  const lead = movementLead(m, tz);
  if (!lead) return '';
  return lead.was ? `${lead.label} ${lead.time}, scheduled ${lead.was}` : `${lead.label} ${lead.time}`;
}

/** "Terminal 3 · Gate K12"; "Gate not posted yet" when neither is known. */
export function placeText(m: Movement): string {
  const parts = [m.terminal ? `Terminal ${m.terminal}` : null, m.gate ? `Gate ${m.gate}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Gate not posted yet';
}

/** Age line, always shown: "Updated 4m ago", with the stale reason when it applies. No spend cap, so no "paused" (Q-049). */
export function ageText(r: FlightStatusResponse, now: number): string {
  const age = r.fetchedAt ? `Updated ${formatAge(Date.parse(r.fetchedAt), now)}` : 'Not updated yet';
  if (r.stale) return `${age} · may be out of date`;
  return age;
}

/**
 * A row's sample status as a sheet response (design round 4), so the sheet
 * says the same thing as the row's tag. The sample arrival assumes a fixed
 * block time; it's moved to the flight's real scheduled arrival, keeping the
 * same delay, so the sheet's times match the row.
 */
export function sampleResponse(
  entry: FlightStatusEntry,
  flight: { to: string; arriveUtc: number },
  date: string,
): FlightStatusResponse {
  const { asOf, stale, delayMin: _delay, ...status } = entry;
  const a = status.arrival;
  const shift = a.scheduledUtc ? flight.arriveUtc - Date.parse(a.scheduledUtc) : 0;
  const move = (iso: string | null) => (iso ? new Date(Date.parse(iso) + shift).toISOString() : null);
  return {
    flightNumber: entry.flightNumber,
    date,
    state: 'ok',
    stale,
    paused: false,
    fetchedAt: asOf,
    status: {
      ...status,
      arrival: {
        ...a,
        airport: a.airport ?? flight.to,
        scheduledUtc: new Date(flight.arriveUtc).toISOString(),
        estimatedUtc: move(a.estimatedUtc),
        actualUtc: move(a.actualUtc),
      },
    },
  };
}
