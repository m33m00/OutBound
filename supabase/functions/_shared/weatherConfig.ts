/**
 * Every weather number in one place: classifier thresholds (Q-027), cache times, time windows.
 * Pure TypeScript, NO imports (Deno and Jest both load it). Tests read these values, never hard-code them.
 */

export type WeatherLevel = 'none' | 'caution' | 'likelyDelays';

export interface WeatherConfig {
  /** Ceiling = lowest BKN / OVC / vertical-visibility layer, in feet. */
  ceilingFt: {
    /** LIFR: below this is Likely delays. */
    likelyBelow: number;
    /** IFR: below this (and not LIFR) is Caution. */
    cautionBelow: number;
  };
  /** Visibility in statute miles. */
  visSm: {
    /** Below this is Likely delays, labelled "Very low visibility". */
    likelyBelowHalf: number;
    /** LIFR: below this is Likely delays. */
    likelyBelow: number;
    /** IFR: below this (and not LIFR) is Caution. */
    cautionBelow: number;
    /** Fog / mist (FG, BR) with visibility below this is Caution. */
    fogCautionBelow: number;
  };
  windKt: {
    gustLikelyAtOrAbove: number;
    gustCautionAtOrAbove: number;
    sustainedCautionAtOrAbove: number;
  };
  /** Highest level a TEMPO / PROB group may produce (they are not prevailing). */
  temporaryMaxLevel: 'caution' | 'likelyDelays';
  /** Server cache lifetimes. */
  cacheMs: { metar: number; taf: number };
  /** Destination window = scheduled arrival +/- this. */
  destinationPadMs: number;
  /** The latest METAR is also used when the window starts within this long from now. */
  metarHorizonMs: number;
  /** Ignore a METAR older than this (relative to now). */
  metarMaxAgeMs: number;
  /** `hours` sent to the METAR endpoint (we keep the newest report per station). */
  metarLookbackHours: number;
  /** Stations per request (batched upstream in one call per product). */
  maxRequestsPerCall: number;
  /** Max entries kept in each in-memory cache. */
  maxCacheEntries: number;
}

export const WEATHER_CONFIG: WeatherConfig = {
  ceilingFt: { likelyBelow: 500, cautionBelow: 1000 },
  visSm: { likelyBelowHalf: 0.5, likelyBelow: 1, cautionBelow: 3, fogCautionBelow: 2 },
  windKt: { gustLikelyAtOrAbove: 40, gustCautionAtOrAbove: 30, sustainedCautionAtOrAbove: 25 },
  temporaryMaxLevel: 'caution',
  cacheMs: { metar: 5 * 60 * 1000, taf: 15 * 60 * 1000 },
  destinationPadMs: 60 * 60 * 1000,
  metarHorizonMs: 2 * 60 * 60 * 1000,
  metarMaxAgeMs: 3 * 60 * 60 * 1000,
  metarLookbackHours: 3,
  maxRequestsPerCall: 40,
  maxCacheEntries: 1000,
};

/** IATA -> ICAO where ICAO is not 'K' + IATA (Alaska, Hawaii, territories). */
export const ICAO_EXCEPTIONS: Record<string, string> = {
  HNL: 'PHNL', OGG: 'PHOG', KOA: 'PHKO', LIH: 'PHLI', ITO: 'PHTO', MKK: 'PHMK', LNY: 'PHNY',
  ANC: 'PANC', FAI: 'PAFA', JNU: 'PAJN', KTN: 'PAKT', SIT: 'PASI', BET: 'PABE', OME: 'PAOM',
  OTZ: 'PAOT', BRW: 'PABR', ADQ: 'PADQ', CDV: 'PACV', DLG: 'PADL', AKN: 'PAKN', SCC: 'PASC',
  SJU: 'TJSJ', BQN: 'TJBQ', PSE: 'TJPS', STT: 'TIST', STX: 'TISX',
  GUM: 'PGUM', SPN: 'PGSN',
};
