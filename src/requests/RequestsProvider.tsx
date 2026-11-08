import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Flight } from '@/engine';
import { useMembershipOptional } from '@/membership/MembershipProvider';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { useSettingsOptional } from '@/settings/SettingsProvider';
import { playYaoom } from '@/ui/sounds';

import {
  addAnsweredAsk,
  addAsk,
  answeredIds,
  askFor,
  askState,
  cancelAsk,
  flightKey,
  newlyAnswered,
  sampleFeed,
  sampleMine,
  type AskState,
  type LoadAnswer,
  type LoadRequest,
} from './requests';

interface RequestsContextValue {
  /** Your asks, newest first (My Trips). */
  mine: LoadRequest[];
  askStateFor: (flight: Flight, now: number) => AskState;
  ask: (flight: Flight) => void;
  /** Your ask on this flight (waiting or answered). */
  askFor: (flight: Flight) => LoadRequest | null;
  /** Take back a waiting ask. */
  cancelAsk: (flight: Flight) => void;
  /** A requested route's loads, already answered (round 176 demo: Free and Pay as you go). */
  addAnswered: (flight: Flight, answer: LoadAnswer) => void;
  /** Your report on a flight this session, if any. */
  reportFor: (flight: Flight) => LoadAnswer | null;
  report: (flight: Flight, open: number, listed: number) => void;
  /** Answers you gave on the Requests tab, by request id (kept here so the tab's badge knows). */
  feedAnswers: Record<string, LoadAnswer>;
  answerFeed: (id: string, answer: LoadAnswer) => void;
  /** Asks on your airline's flights still waiting for an answer: the Requests tab's badge (round 167). */
  openFeedCount: (now: number) => number;
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
  const [feedAnswers, setFeedAnswers] = useState<Record<string, LoadAnswer>>({});
  const answerFeed = useCallback((id: string, answer: LoadAnswer) => setFeedAnswers((a) => ({ ...a, [id]: answer })), []);

  const ask = useCallback((flight: Flight) => setMine((list) => addAsk(list, flight, Date.now())), []);
  const cancel = useCallback((flight: Flight) => setMine((list) => cancelAsk(list, flight)), []);
  // Round 181, John: a yaoom when a request is answered. Asks already answered when the app opens stay
  // quiet; one sound for each batch that comes in (a requested route's legs land together).
  const sounds = useSettingsOptional()?.settings.sounds ?? false;
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(answeredIds(mine));
      return;
    }
    const fresh = newlyAnswered(seen.current, mine);
    if (!fresh.length) return;
    fresh.forEach((id) => seen.current!.add(id));
    if (sounds) playYaoom();
  }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const membership = useMembershipOptional();
  const earn = membership?.earnForAnswer;
  const report = useCallback(
    (flight: Flight, open: number, listed: number) => {
      setReports((r) => ({ ...r, [flightKey(flight)]: { open, listed, at: Date.now(), byYou: true } }));
      // Answering a load earns a credit on Free and Pay as you go (round 176), once per flight.
      earn?.(flightKey(flight), `Answered ${flight.airline} ${flight.flightNumber}`);
    },
    [earn],
  );
  const addAnswered = useCallback(
    (flight: Flight, answer: LoadAnswer) => setMine((list) => addAnsweredAsk(list, flight, answer)),
    [],
  );

  const value = useMemo<RequestsContextValue>(
    () => ({
      mine,
      askStateFor: (flight, now) => askState(mine, flight, now),
      ask,
      askFor: (flight) => askFor(mine, flight),
      cancelAsk: cancel,
      addAnswered,
      reportFor: (flight) => reports[flightKey(flight)] ?? null,
      report,
      feedAnswers,
      answerFeed,
      openFeedCount: (now) => feedAsks(now).filter((r) => !feedAnswers[r.id]).length,
    }),
    [mine, reports, ask, cancel, addAnswered, report, feedAnswers, answerFeed],
  );
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

/** The asks the Requests tab shows: sample asks until the requests backend exists. */
export const feedAsks = (now: number): LoadRequest[] => (SCHEDULE_SOURCE === 'live' ? [] : sampleFeed(now));

export function useRequests(): RequestsContextValue {
  const v = useContext(RequestsContext);
  if (!v) throw new Error('useRequests needs RequestsProvider');
  return v;
}
