import type { Flight } from '@/engine';

/**
 * Flagging and hiding other people's loads (App Store round 2; Apple guideline 1.2 for content
 * people share: a way to report it and a way to block whoever sent it). Pure parts, for tests.
 *
 * Today seat reports and answers aren't shared between phones yet, so this works on this phone:
 * a flagged report is hidden at once and remembered. When shared reports go live, each one must
 * carry an opaque sender id (never shown) so "Hide This Person's Reports" hides all of theirs, and
 * flags must go to the server for review within 24 hours, as the terms promise.
 */

export type FlagReason = 'wrong' | 'abusive' | 'block';

export interface ModerationState {
  /** Content keys flagged on this phone, with why and when. */
  flagged: Record<string, { reason: FlagReason; at: number }>;
  /** Sender ids whose reports this person never wants to see. */
  blocked: string[];
}

export const EMPTY_MODERATION: ModerationState = { flagged: {}, blocked: [] };
export const MODERATION_KEY = 'outbound.moderation.v1';

/** One piece of shared content: a crowd seat report or an answer to your ask, on one flight. */
export function contentKey(flight: Pick<Flight, 'airline' | 'flightNumber' | 'departUtc'>, kind: 'report' | 'answer', at: number): string {
  return `${flight.airline}${flight.flightNumber}@${flight.departUtc}:${kind}:${at}`;
}

export function flag(state: ModerationState, key: string, reason: FlagReason, now: number, senderId?: string): ModerationState {
  const blocked = reason === 'block' && senderId && !state.blocked.includes(senderId) ? [...state.blocked, senderId] : state.blocked;
  return { flagged: { ...state.flagged, [key]: { reason, at: now } }, blocked };
}

export function isHidden(state: ModerationState, key: string, senderId?: string): boolean {
  return key in state.flagged || (senderId != null && state.blocked.includes(senderId));
}

/** Reads what was saved, dropping anything malformed. */
export function parseModeration(raw: string | null): ModerationState {
  if (!raw) return EMPTY_MODERATION;
  try {
    const v = JSON.parse(raw) as Partial<ModerationState>;
    const flagged = v && typeof v.flagged === 'object' && v.flagged ? v.flagged : {};
    const blocked = Array.isArray(v?.blocked) ? v.blocked.filter((s): s is string => typeof s === 'string') : [];
    return { flagged: flagged as ModerationState['flagged'], blocked };
  } catch {
    return EMPTY_MODERATION;
  }
}
