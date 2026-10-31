/**
 * Reads the barcode on a boarding pass (IATA BCBP, the PDF417, Aztec or QR
 * code on paper and phone passes). Only the flight is kept: the passenger
 * name and booking code are skipped and never leave this function.
 */
import { addDays, localDate } from '@/engine';
import { daysBetween } from '@/engine/time';

/** One flight read off a pass. */
export interface PassLeg {
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  /** "YYYY-MM-DD", the flight's day. */
  date: string;
  /** "12A", when the pass has one. */
  seat?: string;
}

/** Each leg's fixed part: booking code (7) through the size of the extra data (2). */
const LEG_FIXED = 37;
/** Where the first leg's fixed part starts (after "M", leg count, name, e-ticket mark). */
const FIRST_LEG = 23;
/** A pass's day is at most this far ahead of today; anything later is last year's. */
const DAYS_AHEAD = 31;

const AIRPORT = /^[A-Z]{3}$/;
const AIRLINE = /^[A-Z0-9]{2,3}$/;

/** "0123 " -> "123", "0012A" -> "12A". */
function cleanFlightNumber(raw: string): string | null {
  const m = /^0*([1-9]\d{0,3})([A-Z]?)\s*$/.exec(raw);
  return m ? m[1] + m[2] : null;
}

/** "012A" -> "12A"; blanks, "0000" and words like "GATE" read as no seat. */
function cleanSeat(raw: string): string | undefined {
  const m = /^0*([1-9]\d{0,2})([A-Z])$/.exec(raw.trim());
  return m ? m[1] + m[2] : undefined;
}

/**
 * Day of the year ("001"-"366") -> "YYYY-MM-DD". Passes leave out the year,
 * so it's the latest such day no more than a month from today.
 */
export function passDate(dayOfYear: number, today: string): string {
  const year = Number(today.slice(0, 4));
  for (const y of [year + 1, year, year - 1]) {
    const date = addDays(`${y}-01-01`, dayOfYear - 1);
    // Day 366 in a year that has 365 spills into the next year: not this year's.
    if (date.slice(0, 4) !== String(y)) continue;
    if (daysBetween(today, date) <= DAYS_AHEAD) return date;
  }
  return addDays(`${year - 1}-01-01`, dayOfYear - 1);
}

function readLeg(text: string, at: number, today: string): { leg: PassLeg; extra: number } | null {
  if (text.length < at + LEG_FIXED) return null;
  const from = text.slice(at + 7, at + 10);
  const to = text.slice(at + 10, at + 13);
  const airline = text.slice(at + 13, at + 16).trim();
  const flightNumber = cleanFlightNumber(text.slice(at + 16, at + 21));
  const day = Number(text.slice(at + 21, at + 24));
  const seat = cleanSeat(text.slice(at + 25, at + 29));
  const extra = parseInt(text.slice(at + 35, at + 37), 16);
  if (!AIRPORT.test(from) || !AIRPORT.test(to) || from === to) return null;
  if (!AIRLINE.test(airline) || !flightNumber) return null;
  if (!Number.isInteger(day) || day < 1 || day > 366) return null;
  const leg: PassLeg = { airline, flightNumber, from, to, date: passDate(day, today) };
  if (seat) leg.seat = seat;
  return { leg, extra: Number.isFinite(extra) ? extra : 0 };
}

/**
 * The flights on a boarding pass barcode, or null when the text isn't one.
 * `now` and `tz` pick the year (passes only carry the day of the year).
 */
export function parseBoardingPass(raw: string, now: number, tz?: string): PassLeg[] | null {
  const text = raw.replace(/\r?\n$/, '');
  if (text[0] !== 'M') return null;
  const count = Number(text[1]);
  if (!Number.isInteger(count) || count < 1 || count > 4) return null;
  const today = localDate(now, tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC');
  const legs: PassLeg[] = [];
  let at = FIRST_LEG;
  for (let i = 0; i < count; i++) {
    const read = readLeg(text, at, today);
    if (!read) break;
    legs.push(read.leg);
    at += LEG_FIXED + read.extra;
  }
  return legs.length ? legs : null;
}
