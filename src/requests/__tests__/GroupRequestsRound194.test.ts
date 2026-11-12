import type { Flight } from '@/engine';

import { addAnsweredAsk, groupRequests, routeHeading, type LoadAnswer, type LoadRequest } from '../requests';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 12, 14);
const fl = (id: string, from: string, to: string, departH: number): Flight =>
  ({
    id,
    airline: 'AA',
    flightNumber: id,
    from,
    to,
    departUtc: T0 + departH * HOUR,
    arriveUtc: T0 + (departH + 2) * HOUR,
  }) as Flight;
const answer = (at: number): LoadAnswer => ({ open: 20, listed: 4, at }) as LoadAnswer;

describe('My Trips keeps a requested route together (round 194, John)', () => {
  it('a connecting route requested from Search lands as one group, in flight order, named for the route', () => {
    const route = { id: 'r1-2026-11-12', title: 'DAL to DEN to LAX' };
    let mine: LoadRequest[] = [];
    mine = addAnsweredAsk(mine, fl('1', 'DAL', 'DEN', 1), answer(T0), route);
    mine = addAnsweredAsk(mine, fl('2', 'DEN', 'LAX', 5), answer(T0), route);
    // A lone flight asked on its own, leaving between the route's legs.
    mine = addAnsweredAsk(mine, fl('9', 'DAL', 'PHX', 3), answer(T0));
    const groups = groupRequests(mine);
    expect(groups.map((g) => g.route?.title ?? g.requests[0].flight.flightNumber)).toEqual(['DAL to DEN to LAX', '9']);
    expect(groups[0].requests.map((r) => r.flight.flightNumber)).toEqual(['1', '2']);
    expect(routeHeading(groups[0].route!.title, groups[0].requests.length)).toBe('DAL to DEN to LAX, 2 legs');
  });

  it('two routes stay apart, and a route with one leg left shows as a single flight', () => {
    const a = { id: 'a', title: 'DAL to DEN to LAX' };
    const b = { id: 'b', title: 'DFW to SEA to LAX' };
    let mine: LoadRequest[] = [];
    mine = addAnsweredAsk(mine, fl('4', 'DFW', 'SEA', 2), answer(T0), b);
    mine = addAnsweredAsk(mine, fl('5', 'SEA', 'LAX', 7), answer(T0), b);
    mine = addAnsweredAsk(mine, fl('1', 'DAL', 'DEN', 1), answer(T0), a);
    const groups = groupRequests(mine);
    expect(groups.map((g) => g.route?.id ?? null)).toEqual([null, 'b']);
    expect(groups[0].requests[0].flight.flightNumber).toBe('1');
  });

  it('requesting the rest of a route later joins the same group', () => {
    const route = { id: 'r', title: 'DAL to DEN to LAX' };
    let mine = addAnsweredAsk([], fl('1', 'DAL', 'DEN', 1), answer(T0), route);
    expect(groupRequests(mine)[0].route).toBeNull();
    mine = addAnsweredAsk(mine, fl('2', 'DEN', 'LAX', 5), answer(T0 + HOUR), route);
    expect(groupRequests(mine)).toHaveLength(1);
    expect(groupRequests(mine)[0].route?.id).toBe('r');
  });
});
