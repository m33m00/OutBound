import sampleXml from '../fixtures/nas-status-sample';
import emptyXml from '../fixtures/nas-status-empty';
import {
  allowRequest,
  getSnapshot,
  isFullAirportClosure,
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

const LAX_REASON =
  '!LAX 05/277 LAX AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC 24HR PPR CTC ATLANTIC AVIATION 310-258-9884 OR SIGNATURE AVIATION 310-410-9605 2605271826-2705281600';

describe('isFullAirportClosure (Q-030)', () => {
  it('real LAX GA restriction -> ignored', () => expect(isFullAirportClosure(LAX_REASON)).toBe(false));
  it('plain full closure -> true', () =>
    expect(isFullAirportClosure('!JFK 10/123 JFK AD AP CLSD 2610140400-2610140600')).toBe(true));
  it('daily-window full closure (SNA) -> true', () =>
    expect(isFullAirportClosure('!SNA 10/016 SNA AD AP CLSD DLY 0630-1315 2610130630-2610171315')).toBe(true));
  it('runway/taxiway/apron only -> false', () => {
    expect(isFullAirportClosure('!ORD 10/001 ORD RWY 10L/28R CLSD 2610140400-2610140600')).toBe(false);
    expect(isFullAirportClosure('!ORD 10/002 ORD AD AP TWY B CLSD')).toBe(false);
    expect(isFullAirportClosure('!ORD 10/003 ORD AD AP APRON CLSD')).toBe(false);
  });
  it('closed to all aircraft except medevac -> true (effectively full)', () =>
    expect(isFullAirportClosure('!XYZ 10/004 XYZ AD AP CLSD TO ALL ACFT EXC MEDEVAC')).toBe(true));
  it('other exemptions/qualifiers -> false', () => {
    expect(isFullAirportClosure('!XYZ 10/005 XYZ AD AP CLSD EXC SKED AIR CARRIER')).toBe(false);
    expect(isFullAirportClosure('!XYZ 10/006 XYZ AD AP CLSD TO HEAVY ACFT')).toBe(false);
  });
  it('non-closure text -> false', () => expect(isFullAirportClosure('')).toBe(false));
  it('parser drops restriction closures but keeps full ones', () => {
    const xml = (a: string, r: string) =>
      `<Delay_type><Name>Airport Closures</Name><Airport_Closure_List><Airport><ARPT>${a}</ARPT><Reason>${r}</Reason><Reopen>May 28 at 16:00 UTC.</Reopen></Airport></Airport_Closure_List></Delay_type>`;
    const s = parseNasXml(`<X>${xml('LAX', LAX_REASON)}${xml('JFK', '!JFK 10/123 JFK AD AP CLSD 2610140400-2610140600')}</X>`, NOW);
    expect(s.airports.LAX).toBeUndefined();
    expect(s.airports.JFK.level).toBe('likelyDelays');
  });
});
