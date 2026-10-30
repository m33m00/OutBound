import type { Flight } from '@/engine';
import { askNote, reportWindow } from '@/requests/requests';
import { useRequests } from '@/requests/RequestsProvider';

import type { FlightLoadActions } from './FlightStatusSheet';
import { selectionTick } from './haptics';
import { useAnnounceLater } from './useAnnounceLater';

/** The flight sheet's Seats card for this flight: report, ask, cancel (rounds 32 and 34). */
export function useFlightLoad(
  flight: Flight | null,
  now: number,
  opts: { fromTrips?: boolean } = {},
): FlightLoadActions | undefined {
  const requests = useRequests();
  // Said a moment later: the button VoiceOver is on changes or goes away in the same frame.
  const announce = useAnnounceLater();
  if (!flight) return undefined;
  return {
    reportWindow: reportWindow(flight, now),
    askState: requests.askStateFor(flight, now),
    yourReport: requests.reportFor(flight),
    askAnswer: requests.askFor(flight)?.answer ?? null,
    onAsk: () => {
      requests.ask(flight);
      selectionTick();
      announce(askNote('asked'));
    },
    onCancelAsk: () => {
      requests.cancelAsk(flight);
      // The button goes away with the ask, so say what happened and what's next.
      announce('Request canceled. You can ask again.');
    },
    onReport: (open, listed) => requests.report(flight, open, listed),
    fromTrips: opts.fromTrips,
  };
}
