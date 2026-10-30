/**
 * Profile tab summary (design round 1): one short line per setting, so the
 * Profile tab shows what's set without opening Settings. Pure, for tests.
 */
import { AIRPORTS } from '@/engine';
import { MAPS_APP_NAME } from '@/search/directions';

import { homeAirports, type Settings } from './settings';

export interface SummaryRow {
  key: 'home' | 'otherHomes' | 'buffer' | 'maps' | 'location' | 'notify' | 'search';
  label: string;
  value: string;
  /** Second line under the label (airport name, etc.). */
  detail?: string;
  /** Something to set up: the value shows as an action (accent). */
  prompt?: boolean;
}

/** "Nonstop only", "Up to 1 stop", "Up to 3 stops". */
export function stopsText(maxStops: number): string {
  if (maxStops <= 0) return 'Nonstop only';
  return `Up to ${maxStops} ${maxStops === 1 ? 'stop' : 'stops'}`;
}

/** "On", "Off", "Answers only", "Airline requests only". */
export function notifyText(s: Settings): string {
  const { answers, airlineAsks } = s.notify;
  if (answers && airlineAsks) return 'On';
  if (answers) return 'Answers only';
  if (airlineAsks) return 'Airline requests only';
  return 'Off';
}

/** `ios`: only iPhone has a maps choice (Android always opens Google Maps). */
export function profileSummary(s: Settings, ios = true): SummaryRow[] {
  const main = s.homes.main;
  const others = homeAirports(s.homes).filter((h) => !h.main);
  return [
    {
      key: 'home',
      label: 'Main home',
      value: main ?? 'Set Up',
      prompt: !main,
      detail: main ? AIRPORTS[main]?.name : 'Used for Get Home and when location is off',
    },
    {
      key: 'otherHomes',
      label: 'Other homes',
      value: others.length ? others.map((h) => h.code).join(', ') : 'None',
    },
    // Same order as the Settings sections they open.
    { key: 'location', label: 'Use your location', value: s.useLocation ? 'On' : 'Off' },
    { key: 'notify', label: 'Notifications', value: notifyText(s) },
    { key: 'buffer', label: 'Airport buffer', value: `${s.bufferMin} min`, detail: 'Before departure' },
    // Where the Leave By card opens directions (round 49); Android has no choice.
    ...(ios ? [{ key: 'maps' as const, label: 'Directions', value: MAPS_APP_NAME[s.mapsApp] }] : []),
    { key: 'search', label: 'Search defaults', value: stopsText(s.search.maxStops) },
  ];
}

/** Settings sections a Profile row can open at (backlog 56). */
export type SettingsSection = 'homes' | 'location' | 'notify' | 'leaveBy' | 'search';

const SECTION_FOR: Record<SummaryRow['key'], SettingsSection> = {
  home: 'homes',
  otherHomes: 'homes',
  buffer: 'leaveBy',
  maps: 'leaveBy',
  location: 'location',
  notify: 'notify',
  search: 'search',
};

/** Section headings as Settings shows them, for "Opens Settings at Leave-by". */
export const SETTINGS_SECTION_TITLE: Record<SettingsSection, string> = {
  homes: 'Homes',
  location: 'Location',
  notify: 'Notifications',
  leaveBy: 'Leave-by',
  search: 'Search defaults',
};

/** Which Settings section a Profile row opens at. */
export const settingsSectionFor = (key: SummaryRow['key']): SettingsSection => SECTION_FOR[key];

/** A section from the route's query, or null for anything else. */
export function parseSettingsSection(raw: unknown): SettingsSection | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'homes' || v === 'location' || v === 'notify' || v === 'leaveBy' || v === 'search' ? v : null;
}
