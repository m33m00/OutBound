/** Text for delay/weather badges (item 7). Pure, shared by rows and the sheet. */
import type { ImpactLevel, RouteImpact, StationImpact } from '@/live';

import { formatAge } from './format';

export const IMPACT_WORD: Record<Exclude<ImpactLevel, 'none'>, string> = {
  caution: 'Caution',
  likelyDelays: 'Likely delays',
};

/** Every value shows its age: "4m ago" on the row ("" when no time is known). */
export function impactAge(impact: Pick<RouteImpact, 'asOf'>, now: number): string {
  return impact.asOf ? formatAge(Date.parse(impact.asOf), now) : '';
}

/** Stations with a badge, worst first. */
export function badgedStations(impact: RouteImpact): StationImpact[] {
  const rank = (s: StationImpact) => (s.level === 'likelyDelays' ? 0 : s.level === 'caution' ? 1 : 2);
  return impact.stations.filter((s) => s.level !== 'none').sort((a, b) => rank(a) - rank(b));
}

/** "Likely delays at ORD: Ground stop, Thunderstorms. Caution at LAX: Gusts 32 kt." */
export function impactSummary(impact: RouteImpact, now: number): string {
  if (impact.level === 'none') return '';
  const parts = badgedStations(impact).map((s) => {
    const reasons = s.reasons.map((r) => r.text).join(', ');
    return `${IMPACT_WORD[s.level as Exclude<ImpactLevel, 'none'>]} at ${s.code}${reasons ? `: ${reasons}` : ''}`;
  });
  const age = impact.asOf ? ` Updated ${formatAge(Date.parse(impact.asOf), now)}${impact.stale ? ', may be out of date' : ''}.` : '';
  return `${parts.join('. ')}.${age}`;
}
