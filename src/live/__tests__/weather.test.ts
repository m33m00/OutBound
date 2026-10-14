import {
  buildWeatherResponse,
  ceilingFromClouds,
  classifyConditions,
  evaluateStation,
  getCachedBatch,
  icaoForIata,
  newBatchCache,
  parseMetarJson,
  parseTafJson,
  parseVisibility,
  parseWeatherRequests,
  type Conditions,
  type Metar,
  type Taf,
  type WeatherLevel,
} from '../../../supabase/functions/_shared/weather';
import { WEATHER_CONFIG as C } from '../../../supabase/functions/_shared/weatherConfig';
import {
  HOUR,
  NOW_MS,
  REAL_METAR,
  REAL_TAF,
  TAF_FROM,
  TAF_ISSUED,
  TAF_TO,
  metarJson,
  tafJson,
  type FcstSpec,
  type MetarSpec,
} from '../fixtures/weather-samples';

const calm = (over: Partial<Conditions> = {}): Conditions => ({
  ceilingFt: null,
  visSm: 10,
  windKt: 5,
  gustKt: null,
  wx: [],
  ...over,
});

/** Classify a METAR fixture built from a spec. */
function fromMetar(spec: Omit<MetarSpec, 'icao'>) {
  const m = parseMetarJson(metarJson([{ icao: 'KTST', ...spec }])).get('KTST')!;
  return classifyConditions(m.cond);
}

describe('parsing helpers', () => {
  it('parseVisibility handles upstream formats', () => {
    expect(parseVisibility('10+')).toBe(10);
    expect(parseVisibility('6+')).toBe(6);
    expect(parseVisibility('P6SM')).toBe(6);
    expect(parseVisibility('1/2')).toBe(0.5);
    expect(parseVisibility('1 1/2')).toBe(1.5);
    expect(parseVisibility('M1/4SM')).toBe(0.25);
    expect(parseVisibility(3)).toBe(3);
    expect(parseVisibility(null)).toBeNull();
    expect(parseVisibility('abc')).toBeNull();
  });
  it('ceiling is the lowest BKN/OVC/VV layer; FEW/SCT never count', () => {
    expect(ceilingFromClouds([{ cover: 'FEW', base: 200 }, { cover: 'SCT', base: 300 }])).toBeNull();
    expect(
      ceilingFromClouds([{ cover: 'SCT', base: 300 }, { cover: 'OVC', base: 900 }, { cover: 'BKN', base: 600 }]),
    ).toBe(600);
    expect(ceilingFromClouds([{ cover: 'OVX', base: 200 }])).toBe(200);
    expect(ceilingFromClouds([], 2)).toBe(200); // vertical visibility in hundreds of feet
    expect(ceilingFromClouds(undefined)).toBeNull();
  });
  it('maps IATA to ICAO', () => {
    expect(icaoForIata('ord')).toBe('KORD');
    expect(icaoForIata('HNL')).toBe('PHNL');
    expect(icaoForIata('ANC')).toBe('PANC');
    expect(icaoForIata('SJU')).toBe('TJSJ');
    expect(icaoForIata('ORDX')).toBeNull();
  });
});

describe('classifier (thresholds from weatherConfig)', () => {
  const none: WeatherLevel = 'none';
  const cases: Array<[string, Omit<MetarSpec, 'icao'>, WeatherLevel, string | null]> = [
    ['VFR', {}, none, null],
    ['MVFR ceiling+vis alone', { visib: C.visSm.cautionBelow + 1, clouds: [{ cover: 'BKN', base: C.ceilingFt.cautionBelow + 500 }] }, none, null],
    ['ceiling exactly at IFR edge is MVFR', { clouds: [{ cover: 'OVC', base: C.ceilingFt.cautionBelow }] }, none, null],
    ['IFR ceiling', { clouds: [{ cover: 'OVC', base: C.ceilingFt.cautionBelow - 1 }] }, 'caution', 'Low clouds'],
    ['IFR ceiling at lower bound', { clouds: [{ cover: 'BKN', base: C.ceilingFt.likelyBelow }] }, 'caution', 'Low clouds'],
    ['LIFR ceiling', { clouds: [{ cover: 'OVC', base: C.ceilingFt.likelyBelow - 1 }] }, 'likelyDelays', 'Low clouds'],
    ['scattered low cloud is not a ceiling', { clouds: [{ cover: 'SCT', base: 200 }] }, none, null],
    ['IFR visibility', { visib: C.visSm.cautionBelow - 0.5 }, 'caution', 'Low visibility'],
    ['visibility at IFR edge', { visib: C.visSm.cautionBelow }, none, null],
    ['IFR visibility lower bound', { visib: C.visSm.likelyBelow }, 'caution', 'Low visibility'],
    ['LIFR visibility', { visib: C.visSm.likelyBelow - 0.25 }, 'likelyDelays', 'Low visibility'],
    ['very low visibility', { visib: C.visSm.likelyBelowHalf - 0.25 }, 'likelyDelays', 'Very low visibility'],
    ['VCTS', { wxString: 'VCTS' }, 'caution', 'Thunderstorms nearby'],
    ['TS', { wxString: 'TS' }, 'likelyDelays', 'Thunderstorms'],
    ['+TSRA', { wxString: '+TSRA' }, 'likelyDelays', 'Thunderstorms'],
    ['gust caution', { wspd: 18, wgst: C.windKt.gustCautionAtOrAbove + 2 }, 'caution', `Gusts ${C.windKt.gustCautionAtOrAbove + 2} kt`],
    ['gust just under caution', { wspd: 18, wgst: C.windKt.gustCautionAtOrAbove - 1 }, none, null],
    ['gust at likely edge', { wspd: 25, wgst: C.windKt.gustLikelyAtOrAbove }, 'likelyDelays', `Gusts ${C.windKt.gustLikelyAtOrAbove} kt`],
    ['gust likely', { wspd: 30, wgst: C.windKt.gustLikelyAtOrAbove + 5 }, 'likelyDelays', `Gusts ${C.windKt.gustLikelyAtOrAbove + 5} kt`],
    ['sustained wind', { wspd: C.windKt.sustainedCautionAtOrAbove }, 'caution', `Strong wind ${C.windKt.sustainedCautionAtOrAbove} kt`],
    ['sustained just under', { wspd: C.windKt.sustainedCautionAtOrAbove - 1 }, none, null],
    ['light snow', { wxString: '-SN' }, 'caution', 'Light snow'],
    ['moderate snow', { wxString: 'SN' }, 'likelyDelays', 'Snow'],
    ['heavy snow', { wxString: '+SN' }, 'likelyDelays', 'Heavy snow'],
    ['snow showers light', { wxString: '-SHSN' }, 'caution', 'Light snow'],
    ['blowing snow is Caution', { wxString: 'BLSN' }, 'caution', 'Blowing snow'],
    ['light ice pellets', { wxString: '-PL' }, 'caution', 'Light ice pellets'],
    ['moderate ice pellets (Q-029)', { wxString: 'PL' }, 'likelyDelays', 'Ice pellets'],
    ['sustained wind at likely edge (Q-029)', { wspd: C.windKt.sustainedLikelyAtOrAbove }, 'likelyDelays', `Strong wind ${C.windKt.sustainedLikelyAtOrAbove} kt`],
    ['sustained wind just under likely (Q-029)', { wspd: C.windKt.sustainedLikelyAtOrAbove - 1 }, 'caution', `Strong wind ${C.windKt.sustainedLikelyAtOrAbove - 1} kt`],
    ['heavy freezing rain', { wxString: '+FZRA' }, 'likelyDelays', 'Freezing rain'],
    ['heavy freezing drizzle', { wxString: '+FZDZ' }, 'likelyDelays', 'Freezing drizzle'],
    ['heavy ice pellets', { wxString: '+PL' }, 'likelyDelays', 'Heavy ice pellets'],
    ['freezing rain', { wxString: 'FZRA' }, 'likelyDelays', 'Freezing rain'],
    ['light freezing rain', { wxString: '-FZRA' }, 'likelyDelays', 'Freezing rain'],
    ['light freezing drizzle', { wxString: '-FZDZ' }, 'caution', 'Freezing drizzle'],
    ['freezing drizzle', { wxString: 'FZDZ' }, 'likelyDelays', 'Freezing drizzle'],
    ['fog with vis under limit', { wxString: 'FG', visib: C.visSm.fogCautionBelow - 0.25 }, 'caution', 'Fog'],
    ['fog at limit is only the IFR visibility Caution (no Fog label)', { wxString: 'BR', visib: C.visSm.fogCautionBelow }, 'caution', 'Low visibility'],
    ['mist with decent vis', { wxString: 'BR', visib: 3 }, none, null],
    ['rain alone', { wxString: '-RA' }, none, null],
  ];
  it.each(cases)('%s', (_name, spec, level, label) => {
    const r = fromMetar(spec);
    expect(r.level).toBe(level);
    if (label) expect(r.findings.map((f) => f.label)).toContain(label);
    else expect(r.findings).toEqual([]);
  });

  it('worst condition wins and reasons list worst first', () => {
    const r = classifyConditions(
      calm({ ceilingFt: C.ceilingFt.cautionBelow - 100, wx: ['TSRA', '-SN'], gustKt: C.windKt.gustCautionAtOrAbove }),
    );
    expect(r.level).toBe('likelyDelays');
    expect(r.findings[0].label).toBe('Thunderstorms');
    expect(r.findings.map((f) => f.level)).toEqual([...r.findings.map((f) => f.level)].sort().reverse());
  });
  it('does not repeat a reason', () => {
    const r = classifyConditions(calm({ wx: ['-SN', '-SHSN'] }));
    expect(r.findings.filter((f) => f.label === 'Light snow')).toHaveLength(1);
  });
  it('real capture: ORD SPECI -RA BR 4SM OVC046 (MVFR) shows nothing; JFK/HNL VFR nothing', () => {
    const m = parseMetarJson(REAL_METAR);
    expect([...m.keys()].sort()).toEqual(['KJFK', 'KORD', 'PHNL']);
    for (const mm of m.values()) expect(classifyConditions(mm.cond).level).toBe('none');
    expect(m.get('KORD')!.cond.wx).toEqual(['-RA', 'BR']);
    expect(m.get('KORD')!.cond.ceilingFt).toBe(4600);
    expect(m.get('KORD')!.cond.visSm).toBe(4);
  });
});

// ---------------------------------------------------------------- evaluateStation

const ev = (
  metar: Metar | null,
  taf: Taf | null,
  fromMs: number,
  toMs: number,
  extra: { stale?: boolean; station?: string; now?: number } = {},
) =>
  evaluateStation({
    request: { station: extra.station ?? 'TST', fromMs, toMs },
    nowMs: extra.now ?? NOW_MS,
    metar,
    taf,
    stale: extra.stale ?? false,
  });

const metar = (spec: Omit<MetarSpec, 'icao'> = {}) => parseMetarJson(metarJson([{ icao: 'KTST', ...spec }])).get('KTST')!;
const taf = (fcsts: FcstSpec[], from = TAF_FROM, to = TAF_TO, issued = TAF_ISSUED) =>
  parseTafJson(tafJson('KTST', issued, from, to, fcsts)).get('KTST')!;
const base = (over: Partial<FcstSpec> = {}): FcstSpec => ({ fromMs: TAF_FROM, toMs: TAF_TO, ...over });

describe('evaluateStation: TAF groups', () => {
  const T = NOW_MS + 6 * HOUR; // traveler is at the station well after "now"

  it('calm forecast -> ok / none, with issuedAt and no METAR (too far out)', () => {
    const r = ev(metar({ wxString: 'TS' }), taf([base()]), T, T + HOUR);
    expect(r).toMatchObject({ state: 'ok', level: 'none', reasons: [], observedAt: null });
    expect(r.issuedAt).toBe(new Date(TAF_ISSUED).toISOString());
    expect(r.asOf).toBe(r.issuedAt);
  });

  it('FM group that begins inside the window counts; one before it does not', () => {
    const t = taf([
      base({ toMs: T }),
      base({ change: 'FM', fromMs: T, toMs: TAF_TO, wxString: 'TSRA', clouds: [{ cover: 'BKN', base: 3000 }] }),
    ]);
    expect(ev(null, t, T - 2 * HOUR, T - HOUR).level).toBe('none'); // before the FM
    const hit = ev(null, t, T - 30 * 60_000, T + 30 * 60_000);
    expect(hit.level).toBe('likelyDelays');
    expect(hit.reasons).toContain('Thunderstorms');
    expect(ev(null, t, T + HOUR, T + 2 * HOUR).level).toBe('likelyDelays');
  });

  it('an FM that has already replaced the bad weather means none', () => {
    const t = taf([
      base({ toMs: T - 3 * HOUR, wxString: 'TSRA' }),
      base({ change: 'FM', fromMs: T - 3 * HOUR }),
    ]);
    expect(ev(null, t, T, T + HOUR).level).toBe('none');
  });

  it('TEMPO is capped at Caution and marked possible', () => {
    const t = taf([
      base(),
      { change: 'TEMPO', fromMs: T, toMs: T + 2 * HOUR, wxString: '+TSRA', visib: 1, clouds: [{ cover: 'OVC', base: C.ceilingFt.likelyBelow - 100 }] },
    ]);
    const r = ev(null, t, T, T + HOUR);
    expect(r.level).toBe(C.temporaryMaxLevel);
    expect(r.reasons).toEqual(expect.arrayContaining(['Thunderstorms (possible)', 'Low clouds (possible)']));
    expect(r.reasons).not.toContain('Thunderstorms');
  });

  it('PROB group is treated like TEMPO', () => {
    const t = taf([base(), { change: 'PROB', probability: 30, fromMs: T, toMs: T + 3 * HOUR, wxString: 'TS' }]);
    const r = ev(null, t, T, T + HOUR);
    expect(r.level).toBe('caution');
    expect(r.reasons).toEqual(['Thunderstorms (possible)']);
  });

  it('TEMPO outside the window is ignored', () => {
    const t = taf([base(), { change: 'TEMPO', fromMs: T + 3 * HOUR, toMs: T + 4 * HOUR, wxString: 'TS' }]);
    expect(ev(null, t, T, T + HOUR).level).toBe('none');
  });

  it('BECMG counts as prevailing from the start of the change', () => {
    const t = taf([base(), { change: 'BECMG', fromMs: T - HOUR, toMs: TAF_TO, visib: 0.25 }]);
    expect(ev(null, t, T, T + HOUR).level).toBe('likelyDelays');
  });

  it('connection window spans landing to next departure: worst period in it wins', () => {
    const t = taf([
      base({ toMs: T + HOUR }),
      base({ change: 'FM', fromMs: T + HOUR, toMs: TAF_TO, wspd: 20, wgst: C.windKt.gustLikelyAtOrAbove + 2 }),
    ]);
    const r = ev(null, t, T, T + 3 * HOUR);
    expect(r.level).toBe('likelyDelays');
    expect(r.reasons).toEqual([`Gusts ${C.windKt.gustLikelyAtOrAbove + 2} kt`]);
    expect(r.raw?.gustKt).toBe(C.windKt.gustLikelyAtOrAbove + 2);
  });

  it('window beyond the TAF valid period -> noForecast, level none (not an error)', () => {
    const r = ev(metar(), taf([base()]), TAF_TO + HOUR, TAF_TO + 2 * HOUR);
    expect(r).toMatchObject({ state: 'noForecast', level: 'none', reasons: [], issuedAt: null, asOf: null });
  });

  it('window overlapping the end of the TAF classifies the covered part', () => {
    const t = taf([base({ wxString: 'FZRA' })]);
    expect(ev(null, t, TAF_TO - HOUR, TAF_TO + 5 * HOUR).level).toBe('likelyDelays');
  });
});

describe('evaluateStation: METAR + TAF', () => {
  it('uses the METAR when the window starts within the horizon: worst of observed and forecast', () => {
    const t = taf([base()]); // calm forecast
    const m = metar({ wxString: '-SN' });
    const near = ev(m, t, NOW_MS + C.metarHorizonMs - 60_000, NOW_MS + C.metarHorizonMs + HOUR);
    expect(near.level).toBe('caution');
    expect(near.observedAt).toBe(new Date(m.obsMs).toISOString());
    expect(near.issuedAt).not.toBeNull();
    // asOf is the oldest of the two (the TAF was issued before the METAR)
    expect(near.asOf).toBe(near.issuedAt);
    const bad = ev(metar(), taf([base({ wxString: 'TS' })]), NOW_MS, NOW_MS + HOUR);
    expect(bad.level).toBe('likelyDelays');
  });
  it('ignores the METAR when the window is beyond the horizon', () => {
    const r = ev(metar({ wxString: 'TS' }), taf([base()]), NOW_MS + C.metarHorizonMs + 60_000, NOW_MS + C.metarHorizonMs + HOUR);
    expect(r.level).toBe('none');
    expect(r.observedAt).toBeNull();
  });
  it('ignores a METAR older than the max age', () => {
    const old = metar({ wxString: 'TS', obsMs: NOW_MS - C.metarMaxAgeMs - 60_000 });
    expect(ev(old, null, NOW_MS, NOW_MS + HOUR)).toMatchObject({ state: 'noForecast', level: 'none' });
  });
  it('METAR alone is enough near-term when the airport has no TAF', () => {
    const r = ev(metar({ wxString: 'FZRA' }), null, NOW_MS + HOUR, NOW_MS + 2 * HOUR);
    expect(r).toMatchObject({ state: 'ok', level: 'likelyDelays', issuedAt: null });
  });
  it('a window that is already over does not use the METAR', () => {
    expect(ev(metar({ wxString: 'TS' }), null, NOW_MS - 3 * HOUR, NOW_MS - HOUR).level).toBe('none');
  });
  it('missing station -> noData, never an error', () => {
    expect(ev(null, null, NOW_MS, NOW_MS + HOUR)).toMatchObject({ state: 'noData', level: 'none', raw: null });
  });
  it('carries the stale flag through', () => {
    expect(ev(metar(), null, NOW_MS, NOW_MS + HOUR, { stale: true }).stale).toBe(true);
  });
});

describe('real TAF capture (KORD has TEMPO and PROB30, KJFK has FM groups)', () => {
  const tafs = parseTafJson(REAL_TAF);
  const at = (iso: string) => Date.parse(iso);
  it('parses both stations and group kinds', () => {
    expect(tafs.get('KORD')!.periods.map((p) => p.kind)).toEqual(['base', 'tempo', 'fm', 'prob', 'fm']);
    expect(tafs.get('KJFK')!.periods.filter((p) => p.kind === 'fm')).toHaveLength(5);
  });
  it('ORD during the TEMPO -TSRA: Caution, possible thunderstorms', () => {
    const r = ev(null, tafs.get('KORD')!, at('2026-10-14T07:00Z'), at('2026-10-14T07:30Z'), { station: 'ORD' });
    expect(r.level).toBe('caution');
    expect(r.reasons).toContain('Thunderstorms (possible)');
    expect(r.issuedAt).toBe('2026-10-14T05:30:00.000Z');
  });
  it('ORD during PROB30 -RADZ 2SM: Caution (low visibility, possible)', () => {
    const r = ev(null, tafs.get('KORD')!, at('2026-10-14T14:00Z'), at('2026-10-14T15:00Z'));
    expect(r.level).toBe('caution');
    expect(r.reasons).toEqual(['Low visibility (possible)']);
  });
  it('ORD mid-morning FM: nothing; JFK gusts 18 kt: nothing', () => {
    expect(ev(null, tafs.get('KORD')!, at('2026-10-14T11:00Z'), at('2026-10-14T12:00Z')).level).toBe('none');
    expect(ev(null, tafs.get('KJFK')!, at('2026-10-14T15:00Z'), at('2026-10-14T16:00Z')).level).toBe('none');
  });
  it('after the TAF ends (2026-10-15 12:00Z) -> noForecast', () => {
    const r = ev(null, tafs.get('KORD')!, at('2026-10-16T12:00Z'), at('2026-10-16T14:00Z'));
    expect(r.state).toBe('noForecast');
  });
});

// ---------------------------------------------------------------- server cache + response

describe('getCachedBatch', () => {
  const load = (calls: string[][], data: Record<string, number> = {}) => async (ids: string[]) => {
    calls.push(ids);
    return new Map(Object.entries(data).filter(([k]) => ids.includes(k)));
  };

  it('fetches once for all missing ids, then serves from cache until the TTL', async () => {
    const cache = newBatchCache<number>();
    const calls: string[][] = [];
    const l = load(calls, { A: 1, B: 2 });
    const r1 = await getCachedBatch(cache, ['A', 'B', 'C'], 1000, C.cacheMs.metar, l);
    expect(calls).toEqual([['A', 'B', 'C']]);
    expect([...r1.values.keys()]).toEqual(['A', 'B']);
    await getCachedBatch(cache, ['A', 'B', 'C'], 1000 + C.cacheMs.metar - 1, C.cacheMs.metar, l);
    expect(calls).toHaveLength(1); // C was cached as a miss too
    await getCachedBatch(cache, ['A', 'D'], 1000 + C.cacheMs.metar, C.cacheMs.metar, l);
    expect(calls[1]).toEqual(['A', 'D']);
  });
  it('serves stale and flags it when the refresh fails', async () => {
    const cache = newBatchCache<number>();
    await getCachedBatch(cache, ['A'], 0, C.cacheMs.taf, load([], { A: 7 }));
    const r = await getCachedBatch(cache, ['A', 'B'], C.cacheMs.taf + 1, C.cacheMs.taf, async () => {
      throw new Error('503');
    });
    expect(r.failed).toBe(true);
    expect(r.values.get('A')).toBe(7);
    expect([...r.staleIds]).toEqual(['A']);
    expect(r.values.has('B')).toBe(false);
  });
  it('bounds the cache size', async () => {
    const cache = newBatchCache<number>();
    await getCachedBatch(cache, ['A', 'B', 'C'], 0, 1000, load([], { A: 1, B: 2, C: 3 }), 2);
    expect(cache.map.size).toBe(2);
  });
});

describe('buildWeatherResponse (upstream error / stale)', () => {
  it('fresh data -> results in request order, stale false', async () => {
    const mc = newBatchCache<Metar>();
    const tc = newBatchCache<Taf>();
    const reqs = [
      { station: 'ORD', fromMs: NOW_MS + HOUR, toMs: NOW_MS + 2 * HOUR },
      { station: 'XYZ', fromMs: NOW_MS, toMs: NOW_MS + HOUR },
    ];
    const metars = await getCachedBatch(mc, ['KORD', 'KXYZ'], NOW_MS, C.cacheMs.metar, async () => parseMetarJson(REAL_METAR));
    const tafs = await getCachedBatch(tc, ['KORD', 'KXYZ'], NOW_MS, C.cacheMs.taf, async () => parseTafJson(REAL_TAF));
    const r = buildWeatherResponse(reqs, metars, tafs, NOW_MS);
    expect(r.stale).toBe(false);
    expect(r.results.map((x) => [x.station, x.state])).toEqual([['ORD', 'ok'], ['XYZ', 'noData']]);
  });
  it('upstream failure with cached data -> stale flag on the affected stations', async () => {
    const mc = newBatchCache<Metar>();
    const tc = newBatchCache<Taf>();
    await getCachedBatch(mc, ['KORD'], 0, C.cacheMs.metar, async () => parseMetarJson(REAL_METAR));
    await getCachedBatch(tc, ['KORD'], 0, C.cacheMs.taf, async () => parseTafJson(REAL_TAF));
    const down = async (): Promise<never> => {
      throw new Error('down');
    };
    const later = NOW_MS;
    const metars = await getCachedBatch(mc, ['KORD'], later, C.cacheMs.metar, down);
    const tafs = await getCachedBatch(tc, ['KORD'], later, C.cacheMs.taf, down);
    const r = buildWeatherResponse([{ station: 'ORD', fromMs: later, toMs: later + HOUR }], metars, tafs, later);
    expect(r.stale).toBe(true);
    expect(r.results[0].stale).toBe(true);
    expect(r.results[0].state).toBe('ok');
  });
});

describe('parseWeatherRequests', () => {
  it('parses windows, defaults bare codes to now..+2h, drops junk and duplicates', () => {
    const r = parseWeatherRequests('ord:1000:2000, JFK ,BAD1,ORD:1000:2000,LAX:x:y', NOW_MS);
    expect(r).toEqual([
      { station: 'ORD', fromMs: 1000, toMs: 2000 },
      { station: 'JFK', fromMs: NOW_MS, toMs: NOW_MS + 2 * HOUR },
    ]);
  });
  it('caps the number of stations', () => {
    const many = Array.from({ length: C.maxRequestsPerCall + 5 }, (_, i) => `A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
    expect(parseWeatherRequests(many.join(','), NOW_MS)).toHaveLength(C.maxRequestsPerCall);
  });
  it('returns [] for nothing', () => {
    expect(parseWeatherRequests(null, NOW_MS)).toEqual([]);
  });
});
