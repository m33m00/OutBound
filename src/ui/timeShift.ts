import type { ColorToken } from '@/theme';

/**
 * How far a time moved from the schedule, in minutes (positive = later), as a tint for the new time
 * (John, 2026-11-02: green when early, red when late depending on how extreme, with neutral, yellow
 * and orange between). Within 5 minutes either way it's on time and stays the plain text color.
 * The struck old time stays muted, and the tag or delay words still say it: color is never the only signal.
 */
export type ShiftKind = 'early' | 'onTime' | 'slight' | 'late' | 'veryLate';

/** Minutes where each step starts. */
export const SHIFT_STEPS = { early: -5, slight: 5, late: 15, veryLate: 45 } as const;

export function shiftKind(min: number | null | undefined): ShiftKind {
  if (min == null || !Number.isFinite(min)) return 'onTime';
  if (min <= SHIFT_STEPS.early) return 'early';
  if (min >= SHIFT_STEPS.veryLate) return 'veryLate';
  if (min >= SHIFT_STEPS.late) return 'late';
  if (min >= SHIFT_STEPS.slight) return 'slight';
  return 'onTime';
}

const TOKEN: Record<ShiftKind, ColorToken | null> = {
  early: 'timeEarly',
  onTime: null,
  slight: 'timeSlight',
  late: 'timeLate',
  veryLate: 'timeVeryLate',
};

/** The text color token for a moved time, or null to keep the plain color. */
export function shiftToken(min: number | null | undefined): ColorToken | null {
  return TOKEN[shiftKind(min)];
}

/** Whole minutes between two UTC ms times (new minus scheduled). */
export const shiftMinutes = (newUtc: number, scheduledUtc: number) => Math.round((newUtc - scheduledUtc) / 60_000);
