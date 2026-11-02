import { shiftKind, shiftMinutes, shiftToken, SHIFT_STEPS } from '../timeShift';

describe('time shift tint (John, 2026-11-02: green early, red late, neutral, yellow and orange between)', () => {
  it('steps: early 5m+, within 5m on time, 5 to 15 late yellow, 15 to 45 orange, 45+ red', () => {
    expect(SHIFT_STEPS).toEqual({ early: -5, slight: 5, late: 15, veryLate: 45 });
    expect(shiftKind(-20)).toBe('early');
    expect(shiftKind(-5)).toBe('early');
    expect(shiftKind(-4)).toBe('onTime');
    expect(shiftKind(0)).toBe('onTime');
    expect(shiftKind(4)).toBe('onTime');
    expect(shiftKind(5)).toBe('slight');
    expect(shiftKind(14)).toBe('slight');
    expect(shiftKind(15)).toBe('late');
    expect(shiftKind(44)).toBe('late');
    expect(shiftKind(45)).toBe('veryLate');
    expect(shiftKind(180)).toBe('veryLate');
  });

  it('unknown shifts and on-time keep the plain text color', () => {
    expect(shiftToken(null)).toBeNull();
    expect(shiftToken(undefined)).toBeNull();
    expect(shiftToken(NaN)).toBeNull();
    expect(shiftToken(2)).toBeNull();
    expect(shiftToken(-12)).toBe('timeEarly');
    expect(shiftToken(8)).toBe('timeSlight');
    expect(shiftToken(30)).toBe('timeLate');
    expect(shiftToken(90)).toBe('timeVeryLate');
  });

  it('minutes between two times, rounded', () => {
    expect(shiftMinutes(25 * 60_000 + 20_000, 0)).toBe(25);
    expect(shiftMinutes(0, 10 * 60_000)).toBe(-10);
  });
});
