import { AccessibilityInfo } from 'react-native';

import type { Flight } from '@/engine';
import { askNote, reportWindow } from '@/requests/requests';
import { useRequests } from '@/requests/RequestsProvider';

import type { FlightLoadActions } from './FlightStatusSheet';
import { selectionTick } from './haptics';

/** The flight sheet's Seats card for this flight: report, ask, cancel (rounds 32 and 34). */
export function useFlightLoad(flight: Flight | null, now: number): FlightLoadActions | undefined {
  const requests = useRequests();
  if (!flight) return undefined;
  return {
    reportWindow: reportWindow(flight, now),
    askState: requests.askStateFor(flight, now),
    yourReport: requests.reportFor(flight),
    askAnswer: requests.askFor(flight)?.answer ?? null,
    onAsk: () => {
      requests.ask(flight);
      selectionTick();
      AccessibilityInfo.announceForAccessibility(askNote('asked'));
    },
    onCancelAsk: () => {
      requests.cancelAsk(flight);
      AccessibilityInfo.announceForAccessibility('Request canceled');
    },
    onReport: (open, listed) => requests.report(flight, open, listed),
  };
}
