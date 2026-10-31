import { parseBoardingPass, passDate } from '../bcbp';

const NOW = Date.UTC(2026, 9, 30, 18); // Fri Oct 30 2026, 1 PM in Dallas
const TZ = 'America/Chicago';

/** The fixed part of one leg, laid out the way passes print it. */
const leg = (from: string, to: string, airline: string, flight: string, day: string, seat: string, extra = '') =>
  `ABC123 ${from}${to}${airline.padEnd(3)}${flight.padEnd(5)}${day}Y${seat}0025 1${extra.length.toString(16).toUpperCase().padStart(2, '0')}${extra}`;

const pass = (legs: string[]) => `M${legs.length}${'YAGER/JOHN'.padEnd(20)}E${legs.join('')}`;

describe('parseBoardingPass', () => {
  it('reads the flight off the IATA sample pass', () => {
    const legs = parseBoardingPass('M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100', NOW, TZ);
    expect(legs).toEqual([{ airline: 'AC', flightNumber: '834', from: 'YUL', to: 'FRA', date: '2026-11-22', seat: '1A' }]);
  });

  it('never returns the name or booking code', () => {
    const legs = parseBoardingPass(pass([leg('DFW', 'LAX', 'AA', '1234', '303', '012C')]), NOW, TZ);
    const text = JSON.stringify(legs);
    expect(text).not.toMatch(/YAGER|JOHN|ABC123/);
    expect(legs).toEqual([{ airline: 'AA', flightNumber: '1234', from: 'DFW', to: 'LAX', date: '2026-10-30', seat: '12C' }]);
  });

  it('reads every leg, skipping each leg’s extra data', () => {
    const legs = parseBoardingPass(
      pass([leg('DAL', 'PHX', 'WN', '0088', '302', '000A', '>5180WW'), leg('PHX', 'LAX', 'WN', '1502', '302', '0000')]),
      NOW,
      TZ,
    );
    expect(legs?.map((l) => `${l.airline}${l.flightNumber} ${l.from}-${l.to} ${l.date} ${l.seat ?? '-'}`)).toEqual([
      'WN88 DAL-PHX 2026-10-29 -',
      'WN1502 PHX-LAX 2026-10-29 -',
    ]);
  });

  it('keeps a flight number letter and drops seats that aren’t seats', () => {
    const [l] = parseBoardingPass(pass([leg('DFW', 'ORD', 'UA', '0450A', '303', 'GATE')]), NOW, TZ) ?? [];
    expect(l.flightNumber).toBe('450A');
    expect(l.seat).toBeUndefined();
  });

  it('turns down text that isn’t a boarding pass', () => {
    expect(parseBoardingPass('https://example.com', NOW, TZ)).toBeNull();
    expect(parseBoardingPass('M1SHORT', NOW, TZ)).toBeNull();
    expect(parseBoardingPass(pass([leg('DFW', 'DFW', 'AA', '1', '303', '001A')]), NOW, TZ)).toBeNull();
    expect(parseBoardingPass(pass([leg('DFW', 'LAX', 'AA', '1', '400', '001A')]), NOW, TZ)).toBeNull();
  });
});

describe('passDate', () => {
  it('picks this year for days up to a month ahead', () => {
    expect(passDate(303, '2026-10-30')).toBe('2026-10-30');
    expect(passDate(334, '2026-10-30')).toBe('2026-11-30');
  });

  it('picks last year for days further ahead', () => {
    expect(passDate(340, '2026-10-30')).toBe('2025-12-06');
  });

  it('crosses New Year both ways', () => {
    expect(passDate(5, '2026-12-28')).toBe('2027-01-05');
    expect(passDate(360, '2027-01-03')).toBe('2026-12-26');
  });

  it('only reads day 366 in a leap year', () => {
    expect(passDate(366, '2029-01-10')).toBe('2028-12-31');
  });
});
