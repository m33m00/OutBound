import { contentKey, EMPTY_MODERATION, flag, isHidden, parseModeration } from '../moderation';

const f = { airline: 'WN', flightNumber: '1234', departUtc: 1_800_000_000_000 };

describe('flagging other people’s loads', () => {
  it('hides a flagged report at once', () => {
    const key = contentKey(f, 'report', 5);
    const s = flag(EMPTY_MODERATION, key, 'wrong', 10);
    expect(isHidden(s, key)).toBe(true);
    expect(isHidden(s, contentKey(f, 'report', 6))).toBe(false);
  });

  it('hiding a person hides everything they send', () => {
    const s = flag(EMPTY_MODERATION, contentKey(f, 'answer', 5), 'block', 10, 'sender-1');
    expect(isHidden(s, contentKey(f, 'report', 99), 'sender-1')).toBe(true);
    expect(isHidden(s, contentKey(f, 'report', 99), 'sender-2')).toBe(false);
    expect(flag(s, 'x', 'block', 11, 'sender-1').blocked).toEqual(['sender-1']);
  });

  it('survives bad saved data', () => {
    expect(parseModeration('nope')).toEqual(EMPTY_MODERATION);
    expect(parseModeration(JSON.stringify({ flagged: { a: { reason: 'wrong', at: 1 } }, blocked: ['b', 3] }))).toEqual({
      flagged: { a: { reason: 'wrong', at: 1 } },
      blocked: ['b'],
    });
  });
});
