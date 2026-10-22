import { MAX_DAYS_OUT } from '@/engine';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DateChip {
  /** "YYYY-MM-DD", local at the origin. */
  date: string;
  /** "Today", "Tomorrow", "Fri 16". */
  label: string;
  /** "Wednesday, October 14" style for VoiceOver and headers. */
  long: string;
}

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: dt.getUTCDay(), month: m - 1, day: d, dt };
}

/** "Wed, Oct 14". */
export function shortDate(date: string): string {
  const p = parts(date);
  return `${WEEKDAYS[p.dow]}, ${MONTHS[p.month]} ${p.day}`;
}

/** Chips for today through MAX_DAYS_OUT (DECISIONS.md: 0-7 days out). */
export function dateChips(today: string): DateChip[] {
  const start = parts(today).dt.getTime();
  return Array.from({ length: MAX_DAYS_OUT + 1 }, (_, i) => {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const p = parts(date);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${WEEKDAYS[p.dow]} ${p.day}`;
    return { date, label, long: `${LONG_DAYS[p.dow]}, ${LONG_MONTHS[p.month]} ${p.day}` };
  });
}

/** Today, Tomorrow and the next two days get chips; later days use the calendar (Q-045). */
export const QUICK_DATE_CHIPS = 4;

/** "YYYY-MM-DD" -> local-midnight Date for the native date picker (it works in the phone's zone). */
export function toPickerDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The picker's Date -> "YYYY-MM-DD", read as the calendar day the user tapped. */
export function fromPickerDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
