/**
 * HAND-WRITTEN AeroDataBox FIDS-shaped samples (from the public AirportFidsContract docs). NOT a real capture: no key
 * existed when these were written. Replace/augment with a recorded response once one exists.
 * Departures from DAL on 2026-10-30 (CDT, UTC-5), as returned with withLeg=true.
 */
const leg = (iata: string | null, utc: string | null, local: string | null) => ({
  ...(iata ? { airport: { iata, icao: `K${iata}`, name: `${iata} airport` } } : {}),
  ...(utc ? { scheduledTime: { utc, local } } : {}),
  quality: ['Basic'],
});

const flight = (number: string, airline: string, dep: ReturnType<typeof leg>, arr: ReturnType<typeof leg>, extra: Record<string, unknown> = {}) => ({
  number,
  status: 'Expected',
  codeshareStatus: 'IsOperator',
  isCargo: false,
  airline: { name: `${airline} airline`, iata: airline, icao: `${airline}X` },
  departure: dep,
  arrival: arr,
  ...extra,
});

/** Morning window: two good flights, plus every kind of row the parser must skip. */
export const FIDS_DAL_MORNING = {
  departures: [
    // Kept: DAL-DEN, 07:30 local.
    flight('WN 311', 'WN', leg(null, '2026-10-30 12:30Z', '2026-10-30 07:30-05:00'), leg('DEN', '2026-10-30 14:35Z', '2026-10-30 08:35-06:00')),
    // Kept: canceled flights stay (live status tags them).
    flight('WN 1205', 'WN', leg(null, '2026-10-30 15:00Z', '2026-10-30 10:00-05:00'), leg('LAX', '2026-10-30 18:20Z', '2026-10-30 11:20-07:00'), {
      status: 'Canceled',
    }),
    // Skipped: codeshare copy of WN 311.
    flight('AS 7311', 'AS', leg(null, '2026-10-30 12:30Z', '2026-10-30 07:30-05:00'), leg('DEN', '2026-10-30 14:35Z', '2026-10-30 08:35-06:00'), {
      codeshareStatus: 'IsCodeshared',
    }),
    // Skipped: cargo.
    flight('5X 900', '5X', leg(null, '2026-10-30 13:00Z', '2026-10-30 08:00-05:00'), leg('ATL', '2026-10-30 15:00Z', '2026-10-30 11:00-04:00'), {
      isCargo: true,
    }),
    // Skipped: destination not in the app's airport table.
    flight('WN 88', 'WN', leg(null, '2026-10-30 14:00Z', '2026-10-30 09:00-05:00'), leg('HOU', '2026-10-30 15:05Z', '2026-10-30 10:05-05:00')),
    // Skipped: no arrival time.
    flight('WN 99', 'WN', leg(null, '2026-10-30 14:10Z', '2026-10-30 09:10-05:00'), leg('PHX', null, null)),
  ],
};

/** Afternoon window: one flight, repeated across the noon seam to test de-duplication. */
export const FIDS_DAL_AFTERNOON = {
  departures: [
    flight('WN 2405', 'WN', leg(null, '2026-10-30 17:00Z', '2026-10-30 12:00-05:00'), leg('BNA', '2026-10-30 18:40Z', '2026-10-30 13:40-05:00')),
  ],
};

/** The same noon flight as returned by the morning window (windows meet at 12:00). */
export const FIDS_DAL_NOON_IN_MORNING = {
  departures: [
    ...FIDS_DAL_MORNING.departures,
    ...FIDS_DAL_AFTERNOON.departures,
  ],
};
