/**
 * Profile tab summary (design round 1): one short line per setting, so the
 * Profile tab shows what's set without opening Settings. Pure, for tests.
 */
import { AIRPORTS } from '@/engine';

import { homeAirports, type Settings } from './settings';

export interface SummaryRow {
  key: 'home' | 'otherHomes' | 'buffer' | 'location' | 'search';
  label: string;
  value: string;
  /** Second line under the label (airport name, etc.). */
  detail?: string;
}

/** "Nonstop only", "Up to 1 stop", "Up to 3 stops". */
export function stopsText(maxStops: number): string {
  if (maxStops <= 0) return 'Nonstop only';
  return `Up to ${maxStops} ${maxStops === 1 ? 'stop' : 'stops'}`;
}

export function profileSummary(s: Settings): SummaryRow[] {
  const main = s.homes.main;
  const others = homeAirports(s.homes).filter((h) => !h.main);
  return [
    {
      key: 'home',
      label: 'Main home',
      value: main ?? 'Not set',
      detail: main ? AIRPORTS[main]?.name : 'Used for Get Home and when location is off',
    },
    {
      key: 'otherHomes',
      label: 'Other homes',
      value: others.length ? others.map((h) => h.code).join(', ') : 'None',
    },
    { key: 'buffer', label: 'Airport buffer', value: `${s.bufferMin} min`, detail: 'Before departure' },
    { key: 'location', label: 'Use my location', value: s.useLocation ? 'On' : 'Off' },
    { key: 'search', label: 'Search defaults', value: stopsText(s.search.maxStops) },
  ];
}
