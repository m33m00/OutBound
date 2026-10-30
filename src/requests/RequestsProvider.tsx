import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Flight } from '@/engine';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';

import { addAsk, askFor, askState, cancelAsk, flightKey, sampleMine, type AskState, type LoadAnswer, type LoadRequest } from './requests';

interface RequestsContextValue {
  /** Your asks, newest first (My Trips). */
  mine: LoadRequest[];
  askStateFor: (flight: Flight, now: number) => AskState;
  ask: (flight: Flight) => void;
  /** Your ask on this flight (waiting or answered). */
  askFor: (flight: Flight) => LoadRequest | null;
  /** Take back a waiting ask. */
  cancelAsk: (flight: Flight) => void;
  /** Your report on a flight this session, if any. */
  reportFor: (flight: Flight) => LoadAnswer | null;
  report: (flight: Flight, open: number, listed: number) => void;
}

const RequestsContext = createContext<RequestsContextValue | null>(null);

/**
 * Your load requests and reports. Until the requests backend exists they
 * live for this session only; with sample flights, My Trips starts with
 * two example asks (design round 31/32).
 */
export function RequestsProvider({ children }: { children: ReactNode }) {
  const [mine, setMine] = useState<LoadRequest[]>(() => (SCHEDULE_SOURCE === 'live' ? [] : sampleMine(Date.now())));
  const [reports, setReports] = useState<Record<string, LoadAnswer>>({});

  const ask = useCallback((flight: Flight) => setMine((list) => addAsk(list, flight, Date.now())), []);
  const cancel = useCallback((flight: Flight) => setMine((list) => cancelAsk(list, flight)), []);
  const report = useCallback(
    (flight: Flight, open: number, listed: number) =>
      setReports((r) => ({ ...r, [flightKey(flight)]: { open, listed, at: Date.now(), byYou: true } })),
    [],
  );

  const value = useMemo<RequestsContextValue>(
    () => ({
      mine,
      askStateFor: (flight, now) => askState(mine, flight, now),
      ask,
      askFor: (flight) => askFor(mine, flight),
      cancelAsk: cancel,
      reportFor: (flight) => reports[flightKey(flight)] ?? null,
      report,
    }),
    [mine, reports, ask, cancel, report],
  );
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

export function useRequests(): RequestsContextValue {
  const v = useContext(RequestsContext);
  if (!v) throw new Error('useRequests needs RequestsProvider');
  return v;
}
