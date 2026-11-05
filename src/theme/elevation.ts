import type { ViewStyle } from 'react-native';

/**
 * Soft depth (round 113, John 2026-11-02: more premium, not over the top). A low, wide shadow
 * lifts cards off the page the way iOS cards sit; give it `shadowColor` from the theme's text
 * color so it follows light and dark. Android uses `elevation`.
 */
export const elevation = {
  /** Result rows, saved route cards. */
  card: { shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  /** Things that float over the map: banners, the search drawer's cards. */
  raised: { shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
} as const satisfies Record<string, ViewStyle>;
