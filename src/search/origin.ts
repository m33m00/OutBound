/**
 * Default search origin (Q-051, backlog 23). Pure rules so they can be tested
 * without a phone: the screen feeds in what it knows.
 */

export interface OriginInputs {
  /**
   * From as picked by hand (picker or swap) this session; undefined = not
   * picked. Null is a real pick (swap with an empty To).
   */
  picked: string | null | undefined;
  /** Nearest airport to the phone, when location is on and a fix exists. */
  nearest: string | null;
  mainHome: string | null;
  lastOrigin: string | null;
}

/** Hand pick > nearest airport > main home > last searched origin > empty. */
export function chooseOrigin(i: OriginInputs): string | null {
  if (i.picked !== undefined) return i.picked;
  return i.nearest ?? i.mainHome ?? i.lastOrigin ?? null;
}

/** Location permission as the phone reports it; 'unknown' until checked. */
export type LocationPermission = 'unknown' | 'undetermined' | 'granted' | 'denied';

/**
 * The launch-time "Start searches from the airport nearest you?" card (Q-051).
 * Shown once: never after Not Now, a denial, or location turned on any way.
 * Waits for saved settings and the permission check so it doesn't flash.
 */
export function showLocationCard(s: {
  settingsLoaded: boolean;
  locationAsked: boolean;
  useLocation: boolean;
  permission: LocationPermission;
}): boolean {
  return s.settingsLoaded && !s.locationAsked && !s.useLocation && s.permission === 'undetermined';
}
