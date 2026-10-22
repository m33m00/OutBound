/**
 * HAND-WRITTEN AeroDataBox-shaped samples (from the public FlightContract docs). NOT a real capture: no key existed
 * when these were written. Replace/augment with a recorded response once one exists.
 */
const mv = (iata: string, sched: string, extra: Record<string, unknown> = {}) => ({
  airport: { iata, name: `${iata} airport` },
  scheduledTime: { utc: sched, local: sched },
  ...extra,
});

/** On time, not yet departed. */
export const ADB_ON_TIME = [
  {
    number: 'AA 100',
    status: 'Expected',
    lastUpdatedUtc: '2026-10-22 10:00Z',
    departure: mv('ORD', '2026-10-22 14:00Z', { terminal: '3', gate: 'K12' }),
    arrival: mv('LAX', '2026-10-22 17:30Z', { terminal: '4', gate: '41B' }),
  },
];

/** 50 min late departure, revised times, no arrival gate yet. */
export const ADB_DELAYED = [
  {
    number: 'DL 2210',
    status: 'Delayed',
    lastUpdatedUtc: '2026-10-22 11:20Z',
    departure: mv('ATL', '2026-10-22 15:00Z', { revisedTime: { utc: '2026-10-22 15:50Z' }, terminal: 'S', gate: 'B22' }),
    arrival: mv('BOS', '2026-10-22 17:30Z', { revisedTime: { utc: '2026-10-22 18:20Z' }, terminal: 'A' }),
  },
];

/** Departed with a runway (actual) time; status string alone says departed. */
export const ADB_DEPARTED = [
  {
    number: 'UA 300',
    status: 'EnRoute',
    lastUpdatedUtc: '2026-10-22 13:10Z',
    departure: mv('DEN', '2026-10-22 12:00Z', { runwayTime: { utc: '2026-10-22 12:12Z' }, gate: 'B7' }),
    arrival: mv('SFO', '2026-10-22 14:30Z', { predictedTime: { utc: '2026-10-22 14:42Z' }, terminal: '3' }),
  },
];

export const ADB_ARRIVED = [
  {
    number: 'AA 100',
    status: 'Arrived',
    lastUpdatedUtc: '2026-10-22 17:40Z',
    departure: mv('ORD', '2026-10-22 14:00Z', { runwayTime: { utc: '2026-10-22 14:05Z' }, terminal: '3', gate: 'K12' }),
    arrival: mv('LAX', '2026-10-22 17:30Z', { runwayTime: { utc: '2026-10-22 17:26Z' }, terminal: '4', gate: '41B' }),
  },
];

export const ADB_CANCELED = [
  {
    number: 'WN 55',
    status: 'Canceled',
    departure: mv('DAL', '2026-10-22 16:00Z'),
    arrival: mv('HOU', '2026-10-22 17:00Z'),
  },
];

export const ADB_DIVERTED = [
  {
    number: 'AS 8',
    status: 'Diverted',
    departure: mv('SEA', '2026-10-22 16:00Z', { runwayTime: { utc: '2026-10-22 16:03Z' } }),
    arrival: mv('ANC', '2026-10-22 19:30Z'),
  },
];

/** Same number, two legs: caller picks by departure airport. */
export const ADB_TWO_LEGS = [
  { number: 'AA 100', status: 'Expected', departure: mv('JFK', '2026-10-22 12:00Z', { gate: '1' }), arrival: mv('ORD', '2026-10-22 14:00Z') },
  { number: 'AA 100', status: 'Expected', departure: mv('ORD', '2026-10-22 15:00Z', { gate: '2' }), arrival: mv('LAX', '2026-10-22 18:00Z') },
];

/** Not delayed per the status string, but revised time is 20 min later: delay minutes decide. */
export const ADB_QUIET_LATE = [
  {
    number: 'B6 9',
    status: 'Expected',
    departure: mv('BOS', '2026-10-22 12:00Z', { revisedTime: { utc: '2026-10-22 12:20Z' } }),
    arrival: mv('FLL', '2026-10-22 15:00Z'),
  },
];
