import type { Itinerary, LegSeats } from '@/engine';
import { DEFAULT_FILTERS, parseSettings } from '@/settings/settings';

import { arrangeResults, canceledHidden, DEFAULT_RESULT_PREFS, routeSeats, sortNote, type ResultPrefs } from '../arrange';
import type { RowStatus } from '../statusTags';

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 13, 12);

const seat = (source: LegSeats['source'], netSeats: number | null): LegSeats => ({
  source,
  tier: 'unknown',
  netSeats,
  asOf: null,
});

/** A route leaving `departH` hours from NOW and landing `arriveH` hours from NOW. */
function route(id: string, departH: number, arriveH: number, legSeats: LegSeats[] = [seat('unknown', null)]): Itinerary {
  return {
    id,
    departUtc: NOW + departH * H,
    arriveUtc: NOW + arriveH * H,
    stops: legSeats.length - 1,
    legs: legSeats.map((seats) => ({ seats })),
  } as unknown as Itinerary;
}

const row = (patch: Partial<RowStatus> = {}): RowStatus => ({
  legs: [],
  risks: [],
  dimmed: false,
  canceled: false,
  spoken: [],
  ...patch,
});

const ids = (list: { id: string }[]) => list.map((r) => r.id);
const prefs = (patch: Partial<ResultPrefs>): ResultPrefs => ({ ...DEFAULT_RESULT_PREFS, ...patch });

describe('routeSeats: seats on the route’s fullest flight', () => {
  it('takes the fewest net seats over reported and estimated legs', () => {
    expect(routeSeats(route('a', 1, 4, [seat('reported', 40), seat('estimate', 2)]))).toBe(2);
  });

  it('skips typical loads and legs with no load (DECISIONS: typical loads are neutral)', () => {
    expect(routeSeats(route('a', 1, 4, [seat('typical', -5), seat('reported', 12)]))).toBe(12);
    expect(routeSeats(route('a', 1, 4, [seat('typical', 30), seat('unknown', null)]))).toBeNull();
  });
});

describe('arrangeResults (Jayden, 2026-11-13)', () => {
  const early = route('early', 1, 8, [seat('reported', 3)]);
  const roomy = route('roomy', 2, 6, [seat('reported', 60), seat('estimate', 45)]);
  const late = route('late', 3, 5, [seat('estimate', 20)]);
  const noLoads = route('noLoads', 4, 7);
  const list = [early, roomy, late, noLoads];

  it('keeps departure order by default, routes that already left on top', () => {
    expect(ids(arrangeResults(list, undefined, DEFAULT_RESULT_PREFS, NOW))).toEqual(['early', 'roomy', 'late', 'noLoads']);
    const statuses = { late: row({ dimmed: true }) };
    expect(ids(arrangeResults(list, statuses, DEFAULT_RESULT_PREFS, NOW))).toEqual(['late', 'early', 'roomy', 'noLoads']);
  });

  it('Most seats puts the route whose fullest flight has the most seats first, no loads last', () => {
    expect(ids(arrangeResults(list, undefined, prefs({ sortBy: 'seats' }), NOW))).toEqual(['roomy', 'late', 'early', 'noLoads']);
  });

  it('Most seats keeps departure order between routes with the same seats', () => {
    const a = route('a', 2, 5, [seat('reported', 10)]);
    const b = route('b', 1, 5, [seat('reported', 10)]);
    expect(ids(arrangeResults([a, b], undefined, prefs({ sortBy: 'seats' }), NOW))).toEqual(['b', 'a']);
  });

  it('Arrival puts the earliest arrival first, using the live time when a flight runs late', () => {
    expect(ids(arrangeResults(list, undefined, prefs({ sortBy: 'arrival' }), NOW))).toEqual([
      'late',
      'roomy',
      'noLoads',
      'early',
    ]);
    const statuses = { late: row({ arrival: { newUtc: NOW + 9 * H, newText: '' } }) };
    expect(ids(arrangeResults(list, statuses, prefs({ sortBy: 'arrival' }), NOW))).toEqual(['roomy', 'noLoads', 'early', 'late']);
  });

  it('in the Most seats and Arrival orders, routes that already left go to the bottom', () => {
    const gone = route('gone', -2, 1, [seat('reported', 90)]);
    const left = route('left', 1, 2, [seat('reported', 80)]);
    const statuses = { left: row({ dimmed: true }) };
    expect(ids(arrangeResults([gone, left, ...list], statuses, prefs({ sortBy: 'seats' }), NOW))).toEqual([
      'roomy',
      'late',
      'early',
      'noLoads',
      'gone',
      'left',
    ]);
    expect(ids(arrangeResults([gone, left, ...list], statuses, prefs({ sortBy: 'arrival' }), NOW)).slice(-2)).toEqual([
      'gone',
      'left',
    ]);
  });

  it('hides routes with a canceled flight by default and shows them when the switch is on', () => {
    const statuses = { roomy: row({ canceled: true }) };
    expect(ids(arrangeResults(list, statuses, DEFAULT_RESULT_PREFS, NOW))).toEqual(['early', 'late', 'noLoads']);
    expect(canceledHidden(list, statuses, DEFAULT_RESULT_PREFS)).toBe(1);
    const on = prefs({ showCanceled: true });
    expect(ids(arrangeResults(list, statuses, on, NOW))).toEqual(['early', 'roomy', 'late', 'noLoads']);
    expect(canceledHidden(list, statuses, on)).toBe(0);
  });

  it('never hides the open route, even when a flight on it is canceled', () => {
    const statuses = { roomy: row({ canceled: true }) };
    expect(ids(arrangeResults(list, statuses, DEFAULT_RESULT_PREFS, NOW, 'roomy'))).toContain('roomy');
    expect(canceledHidden(list, statuses, DEFAULT_RESULT_PREFS, 'roomy')).toBe(0);
  });

  it('a diversion is not a cancellation, so a diverted route stays', () => {
    const statuses = { late: row({ arrivalPending: true }) };
    expect(ids(arrangeResults(list, statuses, DEFAULT_RESULT_PREFS, NOW))).toContain('late');
  });

  it('says which order the list is in when it is not departure order', () => {
    expect(sortNote('departure')).toBeNull();
    expect(sortNote('seats')).toBe('Most seats first, on each route’s fullest flight.');
    expect(sortNote('arrival')).toBe('Earliest arrival first.');
  });
});

describe('itinerary preferences in settings', () => {
  it('default to departure order with canceled routes hidden', () => {
    expect(DEFAULT_FILTERS).toMatchObject({ sortBy: 'departure', showCanceled: false });
    expect(parseSettings({}).search).toMatchObject({ sortBy: 'departure', showCanceled: false });
  });

  it('keep a saved pick and ignore a bad one', () => {
    expect(parseSettings({ search: { sortBy: 'seats', showCanceled: true } }).search).toMatchObject({
      sortBy: 'seats',
      showCanceled: true,
    });
    expect(parseSettings({ search: { sortBy: 'odds', showCanceled: 'yes' } }).search).toMatchObject({
      sortBy: 'departure',
      showCanceled: false,
    });
  });
});
