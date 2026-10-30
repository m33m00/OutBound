import type { SeatTier } from '@/engine';
import type { ColorToken } from '@/theme';

/** Tier text and fill tokens; color is never the only signal (word + number). */
export const TIER_FG: Record<SeatTier, ColorToken> = {
  wide: 'wideFg',
  good: 'goodFg',
  okay: 'okayFg',
  tight: 'tightFg',
  full: 'fullFg',
  unknown: 'unknownFg',
};
export const TIER_BG: Record<SeatTier, ColorToken> = {
  wide: 'wideBg',
  good: 'goodBg',
  okay: 'okayBg',
  tight: 'tightBg',
  full: 'fullBg',
  unknown: 'unknownBg',
};
/** Tier mark color (dots, fills). */
export const TIER_MARK: Record<SeatTier, ColorToken> = {
  wide: 'wide',
  good: 'good',
  okay: 'okay',
  tight: 'tight',
  full: 'full',
  unknown: 'unknown',
};
