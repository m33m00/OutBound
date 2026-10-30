import type { FlightState } from '@/live';
import type { ColorToken } from '@/theme';

/**
 * Status colors (Q-050), shared by row tags and the flight status sheet.
 * Delayed = violet Caution; Departed / Arrived = gray; Canceled / Diverted =
 * canceled red (provisional, Q-053). Amber is never used ("you" only).
 * Words always carry the state; color only backs them up.
 */
export type Tone = 'delayed' | 'gone' | 'canceled';
export const TONE_FG: Record<Tone, ColorToken> = { delayed: 'caution', gone: 'muted', canceled: 'canceledFg' };
export const TONE_BG: Record<Tone, ColorToken> = { delayed: 'cautionBg', gone: 'surface2', canceled: 'canceledBg' };

/** Scheduled (on time) has no tone, like rows with no tag. */
export const STATE_TONE: Record<FlightState, Tone | null> = {
  scheduled: null,
  delayed: 'delayed',
  departed: 'gone',
  arrived: 'gone',
  canceled: 'canceled',
  diverted: 'canceled',
};
