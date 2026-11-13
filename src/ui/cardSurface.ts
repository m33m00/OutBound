import type { ViewStyle } from 'react-native';

import { radius, useColors, useColorSchemeName } from '@/theme';

/**
 * The one card look every screen shares (round 163, John: the other screens need the same premium pass as
 * Search). A white card with the same solid edge as a result ticket, a soft lift in light mode and none in
 * dark mode, where the edge does the work.
 */
export function useCardSurface(opts: { lift?: boolean } = {}): ViewStyle {
  const c = useColors();
  const dark = useColorSchemeName() === 'dark';
  const lift = opts.lift !== false && !dark;
  return {
    backgroundColor: c.surface,
    borderColor: c.cardEdge,
    borderWidth: 1,
    borderRadius: radius.all,
    shadowColor: c.text,
    ...(lift
      ? { shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 }
      : { shadowOpacity: 0 }),
  };
}
