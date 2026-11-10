import { Linking, Platform } from 'react-native';

import type { Airport } from '@/engine';
import { directionsUrls, type GateTarget, type MapsApp } from '@/search/directions';

/**
 * Opens driving directions to the airport, or walking directions to the gate once you're there (round
 * 159, John); tries each link until one opens.
 */
export async function openDirections(airport: Airport, app: MapsApp, walkTo?: GateTarget): Promise<boolean> {
  for (const url of directionsUrls(airport, app, Platform.OS === 'ios', walkTo)) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // App not installed: try the next link.
    }
  }
  return false;
}
