import { AIRPORTS, localDate } from '@/engine';

import {
  afterListText,
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
