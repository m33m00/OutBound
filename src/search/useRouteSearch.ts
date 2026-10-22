import { useCallback, useRef, useState } from 'react';

import {
  createSampleProvider,
  localDate,
  searchRoutes,
  type FlightDataProvider,
  type Itinerary,
  type SearchOptions,
  type SearchRequest,
} from '@/engine';
import { LIMITS, type SearchFilters } from '@/settings/settings';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; request: SearchRequest }
  | {
      status: 'done';
      request: SearchRequest;
      results: Itinerary[];
      /** Only when results is empty: routes the filters hid (0 = no flights that day, Q-047). */
      hiddenCount: number;
      hiddenResults: Itinerary[];
      searchedAt: number;
    }
  | { status: 'error'; request: SearchRequest; message: string };

/** Zone the sample schedule is built in; also the date zone while From is empty. */
export const SAMPLE_TZ = 'America/Chicago';

/**
 * Loosest filter values (the Filters steppers' far ends). Used only to tell
 * "no flights that day" from "your filters hid N routes" (Q-047).
 */
export const LOOSE_FILTERS: SearchFilters = {
  maxStops: 3,
  minConnectSameAirlineMin: LIMITS.minConnectSameAirlineMin.min,
  minConnectSwitchMin: LIMITS.minConnectSwitchMin.min,
  maxLayoverMin: LIMITS.maxLayoverMin.max,
};

let sample: FlightDataProvider | undefined;

/** Sample data until the schedule DB exists. Covers today through +7 days. */
export function sampleProvider(): FlightDataProvider {
  if (!sample) sample = createSampleProvider(localDate(Date.now(), SAMPLE_TZ));
  return sample;
}

/** Runs the itinerary engine. No network: the provider is local data. */
export function useRouteSearch(provider: FlightDataProvider = sampleProvider()) {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const run = useRef(0);

  const search = useCallback(
    async (request: SearchRequest, options: Partial<SearchOptions>) => {
      const id = ++run.current;
      setState({ status: 'loading', request });
      try {
        const out = await searchRoutes(provider, request, options, LOOSE_FILTERS);
        if (id === run.current) setState({ status: 'done', request, ...out, searchedAt: Date.now() });
      } catch (e) {
        if (id === run.current) {
          setState({ status: 'error', request, message: e instanceof Error ? e.message : String(e) });
        }
      }
    },
    [provider],
  );

  const reset = useCallback(() => {
    run.current++;
    setState({ status: 'idle' });
  }, []);

  return { state, search, reset };
}
