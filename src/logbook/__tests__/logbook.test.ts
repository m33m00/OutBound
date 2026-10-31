import {
  addLogged,
  flightMiles,
  groupDigits,
  loggedDay,
  loggedFrom,
  logbookHighlights,
  logbookMonths,
  logbookTotals,
  parseLogbook,
  removeLogged,
  replaceLogged,
  typedFlightProblem,
  type LoggedFlight,
} from '../logbook';

const NOW = Date.UTC(2026, 9, 30, 18);
const TZ = 'America/Chicago';

const f = (from: string, to: string, date: string, addedAt = 0, flightNumber = '1'): LoggedFlight =>
  loggedFrom({ airline: 'AA', flightNumber, from, to, date }, 'manual', addedAt);

describe('logbook', () => {
  it('logs the same flight on the same day once', () => {
    const a = f('DFW', 'LAX', '2026-10-30');
    const list = addLogged(addLogged([], [a]), [{ ...a, addedAt: 99 }, f('LAX', 'DFW', '2026-10-31')]);
    expect(list.map((x) => x.id)).toEqual(['2026-10-30|AA1:DFW-LAX', '2026-10-31|AA1:LAX-DFW']);
    expect(list[0].addedAt).toBe(0);
    expect(removeLogged(list, a.id)).toHaveLength(1);
  });

  it('swaps a fixed flight in place', () => {
    const list = [f('DFW', 'LAX', '2026-10-01'), f('LAX', 'DFW', '2026-10-02')];
    const fixed = f('DFW', 'SAN', '2026-10-01');
    expect(replaceLogged(list, list[0].id, fixed).map((x) => x.to)).toEqual(['SAN', 'DFW']);
    expect(replaceLogged(list, list[0].id, list[0])).toEqual(list);
  });

  it('counts straight-line miles between airports', () => {
    expect(flightMiles('DFW', 'LAX')).toBeGreaterThan(1200);
    expect(flightMiles('DFW', 'LAX')).toBeLessThan(1250);
    expect(flightMiles('DFW', 'ZZZ')).toBeNull();
  });

  it('totals flights, miles and airports', () => {
    const totals = logbookTotals([f('DFW', 'LAX', '2026-10-01'), f('LAX', 'DFW', '2026-10-02'), f('DFW', 'ORD', '2026-10-03')]);
    expect(totals.flights).toBe(3);
    expect(totals.airports).toBe(3);
    expect(totals.miles).toBe(2 * (flightMiles('DFW', 'LAX') ?? 0) + (flightMiles('DFW', 'ORD') ?? 0));
  });

  it('calls out the most flown airport and the longest flight', () => {
    expect(logbookHighlights([f('DFW', 'LAX', '2026-10-01')])).toEqual({ topAirport: null, longest: null });
    const h = logbookHighlights([f('DFW', 'LAX', '2026-10-01'), f('LAX', 'DFW', '2026-10-02'), f('DFW', 'ORD', '2026-10-03')]);
    expect(h.topAirport).toEqual({ code: 'DFW', flights: 3 });
    expect(h.longest).toEqual({ from: 'DFW', to: 'LAX', miles: flightMiles('DFW', 'LAX') });
    // Two flights with no airport in common: no airport to call out.
    expect(logbookHighlights([f('DFW', 'LAX', '2026-10-01'), f('ORD', 'JFK', '2026-10-02')]).topAirport).toBeNull();
  });

  it('groups by month, newest first', () => {
    const months = logbookMonths([
      f('DFW', 'LAX', '2026-09-12'),
      f('DFW', 'ORD', '2026-10-03', 1),
      f('ORD', 'DFW', '2026-10-03', 2, '2'),
      f('LAX', 'DFW', '2026-10-20'),
    ]);
    expect(months.map((m) => m.title)).toEqual(['October 2026', 'September 2026']);
    expect(months[0].flights.map((x) => `${x.from}-${x.to}`)).toEqual(['LAX-DFW', 'ORD-DFW', 'DFW-ORD']);
  });

  it('names nearby days', () => {
    expect(loggedDay('2026-10-30', NOW, TZ)).toBe('Today');
    expect(loggedDay('2026-10-29', NOW, TZ)).toBe('Yesterday');
    expect(loggedDay('2026-10-01', NOW, TZ)).toBe('Thu, Oct 1');
  });

  it('says what a typed flight is missing', () => {
    const ok = { airline: 'AA', flightNumber: '1234', from: 'DFW', to: 'LAX' };
    expect(typedFlightProblem(ok)).toBeNull();
    expect(typedFlightProblem({ ...ok, airline: '' })).toMatch(/airline/);
    expect(typedFlightProblem({ ...ok, flightNumber: '' })).toMatch(/flight number/);
    expect(typedFlightProblem({ ...ok, from: 'DF' })).toMatch(/from/);
    expect(typedFlightProblem({ ...ok, to: '' })).toMatch(/to/);
    expect(typedFlightProblem({ ...ok, to: 'DFW' })).toMatch(/same/);
  });

  it('reads saved JSON and drops bad entries', () => {
    const good = f('DFW', 'LAX', '2026-10-30', 5);
    const back = parseLogbook(JSON.parse(JSON.stringify([good, { ...good, seat: '12A' }, { from: 'DFW' }, 'x', { ...good, date: 'soon' }])));
    expect(back).toEqual([good]);
    expect(parseLogbook({})).toEqual([]);
  });

  it('groups digits', () => {
    expect(groupDigits(0)).toBe('0');
    expect(groupDigits(1234567)).toBe('1,234,567');
  });
});
