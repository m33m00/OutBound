import type { FlightState } from '@/live';
import type { ColorToken } from '@/theme';

/**
 * Status colors (Q-050), shared by row tags and the flight status sheet.
 * Delayed and Diverted = violet Caution (a diversion goes on late, John
 * 2026-11-01); Departed = sky cyan (round 156, John; was gray); Arrived = graphite (round 201, John: "Different colors
 * for departed and arrived"); Canceled = canceled red (Q-053). Amber is never used ("you" only).
 * Words always carry the state; color only backs them up.
 */
export type Tone = 'delayed' | 'gone' | 'landed' | 'canceled';
export const TONE_FG: Record<Tone, ColorToken> = { delayed: 'caution', gone: 'done', landed: 'landed', canceled: 'canceledFg' };
export const TONE_BG: Record<Tone, ColorToken> = {
  delayed: 'cautionBg',
  gone: 'doneBg',
  landed: 'landedBg',
  canceled: 'canceledBg',
};

/** Scheduled (on time) has no tone, like rows with no tag. */
export const STATE_TONE: Record<FlightState, Tone | null> = {
  scheduled: null,
  delayed: 'delayed',
  departed: 'gone',
  arrived: 'landed',
  canceled: 'canceled',
  diverted: 'delayed',
};
