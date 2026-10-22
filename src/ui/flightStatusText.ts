import type { FlightState, FlightStatusResponse, Movement } from '@/live';
import { formatAge, formatTime } from '@/search/format';

export const STATE_WORD: Record<FlightState, string> = {
  scheduled: 'On time',
  delayed: 'Delayed',
  departed: 'In the air',
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

/** "Terminal 3 · Gate K12"; "Gate not posted yet" when neither is known. */
export function placeText(m: Movement): string {
  const parts = [m.terminal ? `Terminal ${m.terminal}` : null, m.gate ? `Gate ${m.gate}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Gate not posted yet';
}

/** Age line, always shown: "Updated 4m ago", with the stale / paused reason when it applies. */
export function ageText(r: FlightStatusResponse, now: number): string {
  const age = r.fetchedAt ? `Updated ${formatAge(Date.parse(r.fetchedAt), now)}` : 'Not updated yet';
  if (r.paused) return `${age} · live updates are paused for now`;
  if (r.stale) return `${age} · may be out of date`;
  return age;
}
