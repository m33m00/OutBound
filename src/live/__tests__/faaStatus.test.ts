import sampleXml from '../fixtures/nas-status-sample';
import emptyXml from '../fixtures/nas-status-empty';
import {
  allowRequest,
  getSnapshot,
  levelForEvent,
  parseMinutes,
  parseNasXml,
  selectAirports,
  type CacheEntry,
} from '../../../supabase/functions/_shared/faaStatus';
import type { AirportStatusLevel as MapLevel } from '../../map/types';
import type { AirportStatusLevel } from '../airportStatus';

const fx = (n: 'sample' | 'empty') => (n === 'sample' ? sampleXml : emptyXml);
const NOW = '2026-10-14T05:25:00.000Z';
const snap = parseNasXml(fx('sample'), NOW);

// Compile-time check that levels match the map's type.
const _same: MapLevel = 'caution' as AirportStatusLevel;
void _same;

describe('parseNasXml', () => {
  it('reads the FAA update time', () => expect(snap.asOf).toBe('2026-10-14T05:22:14.000Z'));
  it('ground stop -> likelyDelays', () => {
    expect(snap.airports.EWR.level).toBe('likelyDelays');
    expect(snap.airports.EWR.events[0]).toMatchObject({ type: 'groundStop', endsAt: '8:15 pm EDT' });
  });
  it('ground delay -> likelyDelays with minutes', () => {
    expect(snap.airports.SFO.level).toBe('likelyDelays');
    expect(snap.airports.SFO.events[0].maxMinutes).toBe(112);
  });
  it('general delay under 60 -> caution', () => {
    expect(snap.airports.ORD.level).toBe('caution');
    expect(snap.airports.ORD.events[0]).toMatchObject({ direction: 'departure', maxMinutes: 30, trend: 'Increasing' });
  });
  it('general delay >= 60 -> likelyDelays (provisional)', () => expect(snap.airports.ATL.level).toBe('likelyDelays'));
  it('closure -> likelyDelays', () => expect(snap.airports.SNA.level).toBe('likelyDelays'));
  it('no events -> empty', () => {
    expect(parseNasXml(fx('empty'), NOW).airports).toEqual({});
  });
  it('selectAirports filters and ignores case', () => {
    expect(Object.keys(selectAirports(snap, ['ord', 'DEN', 'ewr']))).toEqual(['ORD', 'EWR']);
  });
});

describe('helpers', () => {
  it('parseMinutes', () => {
    expect(parseMinutes('45 minutes')).toBe(45);
    expect(parseMinutes('2 hours 10 minutes')).toBe(130);
    expect(parseMinutes('1 hour')).toBe(60);
    expect(parseMinutes('n/a')).toBeUndefined();
  });
  it('levelForEvent boundary', () => {
    expect(levelForEvent({ type: 'delay', reason: '', maxMinutes: 59 })).toBe('caution');
    expect(levelForEvent({ type: 'delay', reason: '', maxMinutes: 60 })).toBe('likelyDelays');
    expect(levelForEvent({ type: 'delay', reason: '' })).toBe('caution');
  });
});

describe('getSnapshot cache', () => {
  const load = jest.fn(async () => snap);
  beforeEach(() => load.mockClear());
  it('caches within TTL, refetches after', async () => {
    const st: { entry: CacheEntry | null } = { entry: null };
    await getSnapshot(st, 0, load);
    await getSnapshot(st, 60_000, load);
    expect(load).toHaveBeenCalledTimes(1);
    await getSnapshot(st, 300_001, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('serves stale on error, throws with empty cache', async () => {
    const st: { entry: CacheEntry | null } = { entry: null };
    const bad = async () => {
      throw new Error('down');
    };
    await expect(getSnapshot(st, 0, bad)).rejects.toThrow();
    await getSnapshot(st, 0, load);
    const r = await getSnapshot(st, 400_000, bad);
    expect(r.stale).toBe(true);
    expect(r.snapshot).toBe(snap);
  });
});

describe('allowRequest', () => {
  it('limits per window and resets', () => {
    const b = new Map();
    for (let i = 0; i < 3; i++) expect(allowRequest(b, 'ip', 0, 3)).toBe(true);
    expect(allowRequest(b, 'ip', 1000, 3)).toBe(false);
    expect(allowRequest(b, 'other', 1000, 3)).toBe(true);
    expect(allowRequest(b, 'ip', 60_000, 3)).toBe(true);
  });
});
