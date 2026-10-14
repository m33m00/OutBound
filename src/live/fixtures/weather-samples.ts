/**
 * Saved/synthetic aviationweather.gov JSON in the shape of the real capture
 * (see weather-real-capture.ts). Builders keep each scenario to one readable line.
 */
export { REAL_METAR, REAL_TAF } from './weather-real-capture';

/** "Now" for the tests: just after the real capture. */
export const NOW_MS = Date.parse('2026-10-14T06:45:00Z');
export const HOUR = 60 * 60 * 1000;
const sec = (ms: number) => Math.floor(ms / 1000);

interface Cloud {
  cover: string;
  base: number;
}

export interface MetarSpec {
  icao: string;
  /** Observation time (ms); default 10 min before NOW_MS. */
  obsMs?: number;
  wspd?: number;
  wgst?: number | null;
  visib?: string | number;
  clouds?: Cloud[];
  wxString?: string | null;
}

export function metarJson(specs: MetarSpec[]): unknown[] {
  return specs.map((s) => ({
    icaoId: s.icao,
    obsTime: sec(s.obsMs ?? NOW_MS - 10 * 60 * 1000),
    wspd: s.wspd ?? 5,
    wgst: s.wgst ?? null,
    visib: s.visib ?? '10+',
    clouds: s.clouds ?? [{ cover: 'FEW', base: 25000 }],
    wxString: s.wxString ?? null,
    metarType: 'METAR',
  }));
}

export interface FcstSpec {
  /** null = base group. */
  change?: 'FM' | 'BECMG' | 'TEMPO' | 'PROB' | null;
  probability?: number | null;
  fromMs: number;
  toMs: number;
  wspd?: number;
  wgst?: number | null;
  visib?: string | number;
  clouds?: Cloud[];
  wxString?: string | null;
}

export function tafJson(
  icao: string,
  issuedMs: number,
  validFromMs: number,
  validToMs: number,
  fcsts: FcstSpec[],
): unknown[] {
  return [
    {
      icaoId: icao,
      issueTime: new Date(issuedMs).toISOString(),
      bulletinTime: new Date(issuedMs).toISOString(),
      validTimeFrom: sec(validFromMs),
      validTimeTo: sec(validToMs),
      fcsts: fcsts.map((f) => ({
        timeFrom: sec(f.fromMs),
        timeTo: sec(f.toMs),
        timeBec: null,
        fcstChange: f.change ?? null,
        probability: f.probability ?? null,
        wspd: f.wspd ?? 6,
        wgst: f.wgst ?? null,
        visib: f.visib ?? '6+',
        vertVis: null,
        wxString: f.wxString ?? null,
        clouds: f.clouds ?? [{ cover: 'FEW', base: 25000 }],
      })),
    },
  ];
}

/** TAF issued 1 h before NOW_MS, valid NOW-1h .. NOW+23h. */
export const TAF_ISSUED = NOW_MS - HOUR;
export const TAF_FROM = NOW_MS - HOUR;
export const TAF_TO = NOW_MS + 23 * HOUR;
