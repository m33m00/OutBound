/**
 * Light, Dark or System (John, 2026-11-07: "a system toggle for light/dark/system mode and
 * automatically set the system mode by default"). Pure, so settings can parse it without React Native.
 */
export type AppearancePref = 'light' | 'dark' | 'system';

/** In the order Settings shows them. */
export const APPEARANCE_PREFS: readonly AppearancePref[] = ['light', 'dark', 'system'];

export const APPEARANCE_LABEL: Record<AppearancePref, string> = { light: 'Light', dark: 'Dark', system: 'System' };

export const DEFAULT_APPEARANCE: AppearancePref = 'system';

/** A saved value (or anything) -> a valid choice; unknown or missing follows the phone. */
export function parseAppearance(v: unknown): AppearancePref {
  return v === 'light' || v === 'dark' ? v : 'system';
}
