import { createMemoryProvider, searchItineraries, zonedToUtc, type Itinerary } from '@/engine';

import {
  addSaved,
  findSaved,
  isPast,
  openRequest,
  parseSavedRoutes,
  removeSaved,
  reopenOutcome,
  routeSignature,
  savedKey,
  savedRouteFlights,
  savedRouteFrom,
  savedRouteTitle,
  savedRouteWhen,
  sortSaved,
} from '../savedRoutes';

const DATE = '2026-10-20';
/** The day before DATE everywhere in the US. */
const NOW = Date.UTC(2026, 9, 19, 12);
const at = (hhmm: string, date = DATE) => zonedToUtc(date, hhmm, 'America/Chicago');
const request = { origin: 'DFW', destination: 'LAX', date: DATE, originArea: false, destinationArea: true };

async function routes(date = DATE, now = NOW): Promise<Itinerary[]> {
  const provider = createMemoryProvider(
    [
      { id: `A${date}`, airline: 'AA', flightNumber: '1234', from: 'DFW', to: 'ORD', departUtc: at('07:05', date), arriveUtc: at('09:20', date) },
      { id: `B${date}`, airline: 'AA', flightNumber: '88', from: 'ORD', to: 'LAX', departUtc: at('10:45', date), arriveUtc: at('15:20', date) },
      { id: `C${date}`, airline: 'UA', flightNumber: '9', from: 'DFW', to: 'LAX', departUtc: at('12:00', date), arriveUtc: at('15:30', date) },
    ],
    {},
  );
  return searchItineraries(provider, { ...request, date }, { now });
}

const twoLeg = (list: Itinerary[]) => list.find((it) => it.legs.length === 2)!;
const nonstop = (list: Itinerary[]) => list.find((it) => it.legs.length === 1)!;

describe('saved routes (Q-043)', () => {
  it('saves the search and the flights, keyed by day and flight numbers', async () => {
    const it = twoLeg(await routes());
    const saved = savedRouteFrom(it, request, NOW);
    expect(saved.key).toBe('2026-10-20|AA1234:DFW-ORD+AA88:ORD-LAX');
    expect(saved.key).toBe(savedKey(it, DATE));
    expect(saved.request).toEqual(request);
    expect(saved.legs.map((l) => `${l.airline} ${l.flightNumber}`)).toEqual(['AA 1234', 'AA 88']);
    expect(saved.savedAt).toBe(NOW);
  });

  it('adds a route once and removes it by key; no limit', async () => {
    const list = await routes();
    const a = savedRouteFrom(twoLeg(list), request, NOW);
    const b = savedRouteFrom(nonstop(list), request, NOW);
    let saved = addSaved(addSaved(addSaved([], a), a), b);
    expect(saved.map((r) => r.key)).toEqual([a.key, b.key]);
    for (let i = 0; i < 30; i++) saved = addSaved(saved, { ...b, key: `${b.key}#${i}` });
    expect(saved.length).toBe(32);
    expect(removeSaved([a, b], a.key)).toEqual([b]);
  });

  it('reads back what it wrote and drops bad entries and repeats', async () => {
    const a = savedRouteFrom(twoLeg(await routes()), request, NOW);
    const stored = JSON.parse(JSON.stringify([a, a, { request: { origin: 'XXX', destination: 'LAX', date: DATE }, legs: a.legs }, 'junk', { request, legs: [] }]));
    expect(parseSavedRoutes(stored)).toEqual([a]);
    expect(parseSavedRoutes(null)).toEqual([]);
    expect(parseSavedRoutes({})).toEqual([]);
  });

  it('opens on its own day, or today once that day has passed', async () => {
    const a = savedRouteFrom(twoLeg(await routes()), request, NOW);
    expect(isPast(a, NOW)).toBe(false);
    expect(openRequest(a, NOW)).toEqual(request);
    // Later the same day (Dallas time) still opens its own day.
    expect(openRequest(a, at('23:30'))).toEqual(request);
    const later = at('09:00', '2026-10-22');
    expect(isPast(a, later)).toBe(true);
    expect(openRequest(a, later)).toEqual({ ...request, date: '2026-10-22' });
  });

  it('lists coming trips by departure, then days that passed', async () => {
    const list = await routes();
    const early = savedRouteFrom(twoLeg(list), request, NOW);
    const noon = savedRouteFrom(nonstop(list), request, NOW);
    const old = savedRouteFrom(nonstop(await routes('2026-10-18', Date.UTC(2026, 9, 17, 12))), { ...request, date: '2026-10-18' }, NOW);
    expect(sortSaved([old, noon, early], NOW).map((r) => r.key)).toEqual([early.key, noon.key, old.key]);
  });

  it('finds the same flights in fresh results, whatever their ids', async () => {
    const a = savedRouteFrom(twoLeg(await routes()), request, NOW);
    const fresh = (await routes()).map((it) => ({ ...it, id: `new-${it.id}` }));
    expect(findSaved(fresh, a)?.id).toBe(twoLeg(fresh).id);
    expect(findSaved(fresh.filter((it) => it.legs.length === 1), a)).toBeUndefined();
    expect(routeSignature(a.legs)).toBe('AA1234:DFW-ORD+AA88:ORD-LAX');
  });

  it('reads as path, day and local times, and flight numbers', async () => {
    const a = savedRouteFrom(twoLeg(await routes()), request, NOW);
    expect(savedRouteTitle(a)).toBe('DFW → ORD → LAX');
    expect(savedRouteWhen(a, NOW)).toBe('Tomorrow · 7:05 AM – 1:20 PM');
    expect(savedRouteWhen(a, at('06:00'))).toBe('Today · 7:05 AM – 1:20 PM');
    expect(savedRouteWhen(a, Date.UTC(2026, 9, 15, 12))).toBe('Tue, Oct 20 · 7:05 AM – 1:20 PM');
    expect(savedRouteFlights(a)).toBe('AA 1234, AA 88');
  });

  it('opens the same flights, from hidden routes if filters hide them, else notes why not', async () => {
    const list = await routes();
    const a = savedRouteFrom(twoLeg(list), request, NOW);
    expect(reopenOutcome({ results: list, hiddenResults: [] }, a, false)).toEqual({ kind: 'open', id: twoLeg(list).id, hidden: false });
    expect(reopenOutcome({ results: [], hiddenResults: list }, a, false)).toEqual({ kind: 'open', id: twoLeg(list).id, hidden: true });
    expect(reopenOutcome({ results: [nonstop(list)], hiddenResults: [] }, a, false)).toEqual({
      kind: 'note',
      text: 'Your saved flights aren’t in this search anymore. Here’s what’s flying that day.',
    });
    // A passed day never opens a route from today's list.
    expect(reopenOutcome({ results: list, hiddenResults: [] }, a, true)).toEqual({
      kind: 'note',
      text: 'Your saved day has passed, so this is today’s search.',
    });
  });
});
