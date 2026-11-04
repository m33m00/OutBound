import { aircraftLabel, sampleAircraft } from '../aircraft';

describe('aircraft type (round 138, John)', () => {
  it('shows the short name crews use', () => {
    expect(aircraftLabel('Boeing 737-800')).toBe('737-800');
    expect(aircraftLabel('Boeing 737 MAX 8')).toBe('737 MAX 8');
    expect(aircraftLabel('Airbus A321 NEO')).toBe('A321neo');
    expect(aircraftLabel('Airbus A320neo')).toBe('A320neo');
    expect(aircraftLabel('Embraer 175')).toBe('E175');
    expect(aircraftLabel('Bombardier CRJ900')).toBe('CRJ900');
    expect(aircraftLabel('A220-300')).toBe('A220-300');
  });

  it('shows nothing when there is no type', () => {
    expect(aircraftLabel(undefined)).toBeNull();
    expect(aircraftLabel('   ')).toBeNull();
  });

  it('gives sample flights a stable, airline-true type', () => {
    expect(sampleAircraft('WN', '311', 120)).toBe(sampleAircraft('WN', '311', 120));
    expect(sampleAircraft('WN', '311', 120)).toMatch(/^737/);
    expect(sampleAircraft('ZZ', '1', 60)).toBeUndefined();
  });
});
