/**
 * Hardcoded sample routes for previewing the map in Expo Go before search
 * results exist (backlog item 4). Not real data and not from src/engine.
 *
 * Dallas (DFW) to New York, arrival order, 11 routes so the top-10 limit
 * shows. Covers: every tier, all four sources (typical draws neutral gray,
 * dashed), two shared paths (DFW>LGA, DFW>ORD>LGA) for ghost-tap grouping,
 * a nearby-airport arrival (EWR), and a 2-stop route.
 *
 * Usage: <GlobeMap routes={devSampleRoutes} /> (selection is then internal).
 */
import type { LineSource, LonLat, RouteLeg, RouteLine, SeatTier } from './types';

const AP: Record<string, LonLat> = {
  DFW: [-97.038, 32.897],
  LGA: [-73.874, 40.777],
  JFK: [-73.779, 40.64],
  EWR: [-74.169, 40.692],
  ORD: [-87.905, 41.979],
  ATL: [-84.428, 33.637],
  CLT: [-80.943, 35.214],
  IAH: [-95.341, 29.984],
  MIA: [-80.291, 25.796],
  DCA: [-77.038, 38.852],
  DEN: [-104.673, 39.862],
};

let legSeq = 0;
function leg(from: string, to: string, tier: SeatTier, source: LineSource): RouteLeg {
  legSeq += 1;
  return {
    id: `dev-leg-${legSeq}`,
    from: AP[from],
    to: AP[to],
    fromCode: from,
    toCode: to,
    tier,
    source,
  };
}

export const devSampleRoutes: readonly RouteLine[] = [
  { id: 'dev-1', legs: [leg('DFW', 'LGA', 'good', 'reported')] },
  {
    id: 'dev-2',
    legs: [leg('DFW', 'ORD', 'wide', 'reported'), leg('ORD', 'LGA', 'tight', 'estimate')],
  },
  { id: 'dev-3', legs: [leg('DFW', 'LGA', 'full', 'reported')] },
  {
    id: 'dev-4',
    legs: [leg('DFW', 'ATL', 'okay', 'estimate'), leg('ATL', 'LGA', 'unknown', 'typical')],
  },
  {
    id: 'dev-5',
    legs: [leg('DFW', 'CLT', 'tight', 'reported'), leg('CLT', 'EWR', 'unknown', 'unknown')],
  },
  {
    id: 'dev-6',
    legs: [leg('DFW', 'IAH', 'good', 'estimate'), leg('IAH', 'JFK', 'okay', 'reported')],
  },
  {
    id: 'dev-7',
    legs: [leg('DFW', 'ORD', 'okay', 'estimate'), leg('ORD', 'LGA', 'good', 'reported')],
  },
  {
    id: 'dev-8',
    legs: [leg('DFW', 'MIA', 'good', 'reported'), leg('MIA', 'LGA', 'wide', 'estimate')],
  },
  {
    id: 'dev-9',
    legs: [leg('DFW', 'DCA', 'okay', 'reported'), leg('DCA', 'LGA', 'good', 'reported')],
  },
  {
    id: 'dev-10',
    legs: [
      leg('DFW', 'DEN', 'unknown', 'unknown'),
      leg('DEN', 'ORD', 'full', 'estimate'),
      leg('ORD', 'LGA', 'good', 'reported'),
    ],
  },
  // 11th: not drawn in the overview (top 10 only).
  { id: 'dev-11', legs: [leg('DFW', 'JFK', 'wide', 'estimate')] },
];
