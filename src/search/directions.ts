/**
 * Driving directions to an airport (John, 2026-10-30: tap the Leave By card).
 * Provisional (not John-decided): Apple Maps by default, Google Maps if picked
 * in Settings; links search the airport by name so the route ends at the
 * terminal, not the middle of the field.
 */
import type { Airport } from '@/engine';

export type MapsApp = 'apple' | 'google';

export const MAPS_APP_NAME: Record<MapsApp, string> = { apple: 'Apple Maps', google: 'Google Maps' };

/** "Dallas Love Field Airport (DAL)". */
export function airportQuery(a: Airport): string {
  const name = /airport/i.test(a.name) ? a.name : `${a.name} Airport`;
  return `${name} (${a.code})`;
}

/**
 * Links to try in order. Google tries its app first, then the web page
 * (which opens the app when iOS can). Other platforms always use Google.
 */
export function directionsUrls(a: Airport, app: MapsApp, ios = true): string[] {
  const q = encodeURIComponent(airportQuery(a));
  const near = `${a.lat},${a.lon}`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
  if (!ios) return [web];
  if (app === 'google') return [`comgooglemaps://?daddr=${q}&center=${near}&directionsmode=driving`, web];
  return [`https://maps.apple.com/?daddr=${q}&sll=${near}&dirflg=d`];
}
