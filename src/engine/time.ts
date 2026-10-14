/**
 * Time zone helpers. All engine math is on UTC instants; these convert
 * to and from an airport's local calendar date and clock time.
 */

const MIN = 60_000;
const DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

function parts(utc: number, tz: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(utc))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

/** Minutes the zone is ahead of UTC at that instant (e.g. -300 for CDT). */
export function tzOffsetMin(utc: number, tz: string): number {
  const p = parts(utc, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(utc / MIN) * MIN) / MIN);
}

/** Local calendar date "YYYY-MM-DD" at that instant in `tz`. */
export function localDate(utc: number, tz: string): string {
  const p = parts(utc, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function parseDate(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError(`Bad date "${date}", expected YYYY-MM-DD`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** UTC instant of local `date` at `hh:mm` in `tz`. */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, mo, d] = parseDate(date);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset across DST changes.
  let utc = wall - tzOffsetMin(wall, tz) * MIN;
  utc = wall - tzOffsetMin(utc, tz) * MIN;
  return utc;
}

/** Whole days from local date `a` to local date `b`. */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = parseDate(a);
  const [yb, mb, db] = parseDate(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

export const minutes = (ms: number) => Math.round(ms / MIN);
