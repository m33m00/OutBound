import { AIRPORTS, localDate, type Flight } from '@/engine';

import {
  addAsk,
  afterListText,
  askNote,
  askState,
  inReportWindow,
  openRequestCount,
  type LoadRequest,
  answerText,
  answerTier,
  clampReport,
  departsText,
  MAX_LISTED,
  MAX_OPEN,
  MAX_OPEN_REQUESTS,
  requestDetail,
  requestTitle,
  sampleFeed,
  sampleMine,
  SAMPLE_MY_AIRLINE,
} from '../requests';

// 2026-10-30 08:00 Central.
const NOW = Date.UTC(2026, 9, 30, 13);

describe('example requests (design round 31)', () => {
  it('Feed asks are about your airline only, still to leave, newest ask first', () => {
    const feed = sampleFeed(NOW);
    expect(feed.length).toBeGreaterThanOrEqual(3);
    expect(feed.every((r) => r.flight.airline === SAMPLE_MY_AIRLINE)).toBe(true);
    expect(feed.every((r) => r.flight.departUtc > NOW)).toBe(true);
    expect(feed.every((r) => r.askedAt < NOW && !r.answer)).toBe(true);
    const asked = feed.map((r) => r.askedAt);
    expect([...asked].sort((a, b) => b - a)).toEqual(asked);
  });

  it('stays the same between renders', () => {
    expect(sampleFeed(NOW)).toEqual(sampleFeed(NOW));
    expect(sampleMine(NOW)).toEqual(sampleMine(NOW));
  });

  it('your own asks: other airlines, one answered and one waiting, under the limit', () => {
    const mine = sampleMine(NOW);
    expect(mine).toHaveLength(2);
    expect(mine.every((r) => r.flight.airline !== SAMPLE_MY_AIRLINE)).toBe(true);
    expect(mine.filter((r) => r.answer)).toHaveLength(1);
    expect(mine.length).toBeLessThanOrEqual(MAX_OPEN_REQUESTS);
    const answered = mine.find((r) => r.answer)!;
    expect(answered.answer!.at).toBeGreaterThan(answered.askedAt);
    expect(answered.answer!.at).toBeLessThanOrEqual(NOW);
  });
});

describe('request words', () => {
  const [req] = sampleFeed(NOW);

  it('title and departure, local at the origin', () => {
    expect(requestTitle(req)).toBe(`${req.flight.airline} ${req.flight.flightNumber} · ${req.flight.from} → ${req.flight.to}`);
    const tz = AIRPORTS[req.flight.from].tz;
    const sameDay = localDate(req.flight.departUtc, tz) === localDate(NOW, tz);
    expect(departsText(req.flight, NOW).startsWith(sameDay ? 'Departs ' : 'Departs tomorrow ')).toBe(true);
    expect(requestDetail(req, NOW)).toMatch(/^Departs .* · asked \d+m ago$/);
  });

  it('an answer reads as tier word with both numbers (Q-065)', () => {
    const a = { open: 21, listed: 3, at: NOW - 5 * 60_000 };
    expect(answerTier(a)).toBe('good');
    expect(answerText(a)).toBe('Good · 21 open · 3 listed');
    expect(requestDetail({ ...req, answer: a }, NOW)).toBe('Good · 21 open · 3 listed · answered 5m ago');
    expect(requestDetail({ ...req, answer: { ...a, byYou: true } }, NOW)).toBe('Good · 21 open · 3 listed · you answered 5m ago');
  });

  it('seats after the list', () => {
    expect(afterListText(9, 3)).toBe('6 seats after the list');
    expect(afterListText(4, 3)).toBe('1 seat after the list');
    expect(afterListText(2, 5)).toBe('No seats after the list');
  });

  it('report fields stay whole numbers in range (listed 0-250)', () => {
    expect(clampReport('listed', 300)).toBe(MAX_LISTED);
    expect(clampReport('open', 999)).toBe(MAX_OPEN);
    expect(clampReport('open', -2)).toBe(0);
    expect(clampReport('open', 4.6)).toBe(5);
    expect(clampReport('listed', Number.NaN)).toBe(0);
  });
});

describe('asking and reporting from a flight (round 32)', () => {
  const NOW2 = Date.UTC(2026, 9, 30, 13);
  const flight = (n: number, departUtc = NOW2 + 3 * 3600_000): Flight => ({
    id: `F${n}`,
    airline: 'AA',
    flightNumber: String(1000 + n),
    from: 'DFW',
    to: 'LAX',
    departUtc,
    arriveUtc: departUtc + 3 * 3600_000,
  });

  it('reports open a week before and close two hours after departure', () => {
    const f = flight(1);
    expect(inReportWindow(f, f.departUtc - 7 * 24 * 3600_000)).toBe(true);
    expect(inReportWindow(f, f.departUtc - 7 * 24 * 3600_000 - 1)).toBe(false);
    expect(inReportWindow(f, f.departUtc + 2 * 3600_000)).toBe(true);
    expect(inReportWindow(f, f.departUtc + 2 * 3600_000 + 1)).toBe(false);
  });

  it('one ask per flight, newest on top, and the same flight from another list counts', () => {
    let mine: LoadRequest[] = [];
    mine = addAsk(mine, flight(1), NOW2);
    expect(mine).toHaveLength(1);
    expect(askState(mine, { ...flight(1), id: 'other-id' }, NOW2)).toBe('asked');
    expect(addAsk(mine, flight(1), NOW2)).toBe(mine);
    mine = addAsk(mine, flight(2), NOW2 + 1);
    expect(mine[0].flight.flightNumber).toBe('1002');
  });

  it('stops at five waiting asks; an answered one frees a slot', () => {
    let mine: LoadRequest[] = [];
    for (let i = 1; i <= MAX_OPEN_REQUESTS; i++) mine = addAsk(mine, flight(i), NOW2);
    expect(openRequestCount(mine)).toBe(5);
    expect(askState(mine, flight(9), NOW2)).toBe('full');
    mine = mine.map((r, i) => (i === 0 ? { ...r, answer: { open: 9, listed: 2, at: NOW2 } } : r));
    expect(askState(mine, flight(9), NOW2)).toBe('ready');
  });

  it('no asks on a flight that has left, and the note says why', () => {
    const gone = flight(3, NOW2 - 60_000);
    expect(askState([], gone, NOW2)).toBe('left');
    expect(addAsk([], gone, NOW2)).toHaveLength(0);
    expect(askNote('left')).toMatch(/left/);
    expect(askNote('full')).toContain('5 requests waiting');
    expect(askNote('asked')).toContain('My Trips');
  });
});
