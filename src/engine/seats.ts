import type { LegSeats, SeatReport, SeatSource, SeatTier } from './types';

/** DECISIONS.md: crowd report > seat-map estimate > typical load > unknown. */
const SOURCE_RANK: Record<SeatSource, number> = { reported: 0, estimate: 1, typical: 2 };

/** Worst first. Used for route color (weakest leg) and the availability tie-break. */
const TIER_ORDER: readonly SeatTier[] = ['full', 'tight', 'okay', 'good', 'wide'];

/** Tier on net seats (open - listed): Wide >=50, Good 15-49, Okay 6-14, Tight 1-5, Full <=0. */
export function tierForNetSeats(net: number): SeatTier {
  if (net >= 50) return 'wide';
  if (net >= 15) return 'good';
  if (net >= 6) return 'okay';
  if (net >= 1) return 'tight';
  return 'full';
}

/** Pick the highest-priority source; newest reading wins within a source. */
export function legSeats(reports: readonly SeatReport[]): LegSeats {
  let best: SeatReport | undefined;
  for (const r of reports) {
    if (
      !best ||
      SOURCE_RANK[r.source] < SOURCE_RANK[best.source] ||
      (r.source === best.source && r.asOf > best.asOf)
    ) {
      best = r;
    }
  }
  if (!best) return { source: 'unknown', tier: 'unknown', netSeats: null, asOf: null };
  const netSeats = best.openSeats - best.listed;
  // Typical loads are neutral: no tier word or color (DECISIONS.md).
  const tier = best.source === 'typical' ? 'unknown' : tierForNetSeats(netSeats);
  return { source: best.source, tier, netSeats, openSeats: best.openSeats, listed: best.listed, asOf: best.asOf };
}

/** Route color = weakest leg, counting only reported and estimate legs. */
export function routeTier(legs: readonly LegSeats[]): SeatTier {
  let worst: SeatTier = 'unknown';
  for (const s of legs) {
    if (s.tier === 'unknown') continue;
    if (worst === 'unknown' || TIER_ORDER.indexOf(s.tier) < TIER_ORDER.indexOf(worst)) worst = s.tier;
  }
  return worst;
}

/** Lower is better: wide 0 ... full 4, unknown 5. */
export function tierRank(tier: SeatTier): number {
  return tier === 'unknown' ? 5 : 4 - TIER_ORDER.indexOf(tier);
}
