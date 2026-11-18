import type { FlightState } from '@/live';
import type { ColorToken } from '@/theme';

/**
 * Status colors (Q-050), shared by row tags and the flight status sheet.
 * Delayed and Diverted = violet Caution (a diversion goes on late, John
 * 2026-11-01); Departed = boarding blue, white words (round 208, John: "change the departed pill to be the same blue color"; sky cyan since round 156); Arrived = graphite (round 201, John: "Different colors
 * for departed and arrived"); Canceled = canceled red (Q-053). Amber is never used ("you" only).
 * Words always carry the state; color only backs them up.
 */
export type Tone = 'delayed' | 'gone' | 'landed' | 'canceled' | 'risk';
export const TONE_FG: Record<Tone, ColorToken> = {
  delayed: 'caution',
  gone: 'onAccent',
  landed: 'landed',
  canceled: 'canceledFg',
  // A connection At risk or Missed: gold (round 202, John).
  risk: 'riskFg',
};
export const TONE_BG: Record<Tone, ColorToken> = {
  risk: 'riskBg',
  delayed: 'cautionBg',
  gone: 'accent',
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
