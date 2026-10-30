import { Linking, Platform } from 'react-native';

import type { Airport } from '@/engine';
import { directionsUrls, type MapsApp } from '@/search/directions';

/** Opens driving directions to the airport; tries each link until one opens. */
export async function openDirections(airport: Airport, app: MapsApp): Promise<boolean> {
  for (const url of directionsUrls(airport, app, Platform.OS === 'ios')) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // App not installed: try the next link.
    }
  }
  return false;
}
