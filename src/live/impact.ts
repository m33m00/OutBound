/**
 * Pure helpers that merge FAA delays and weather into one badge, and pick the stations
 * an itinerary should be checked at. Item 7 (badges) calls these.
 */
import type { Itinerary } from '@/engine/types';
import type { AirportStatus, FaaEvent } from './airportStatus';
import type { StationWeather, WeatherLevel, WeatherRequest } from './airportWeather';

export type ImpactSource = 'FAA' | 'Weather';

export interface ImpactReason {
  source: ImpactSource;
  text: string;
  level: Exclude<WeatherLevel, 'none'>;
}

export interface CombinedImpact {
  /** Worst wins: likelyDelays > caution > none. 'none' = show no badge. */
  level: WeatherLevel;
  reasons: ImpactReason[];
  /** Oldest timestamp among the inputs used (ISO) for "updated 4m ago"; null when no input had one. */
  asOf: string | null;
}

export interface FaaInput {
  status: AirportStatus | null | undefined;
  /** FAA feed timestamp (useAirportStatus().asOf). */
  asOf: string | null | undefined;
}

const RANK: Record<WeatherLevel, number> = { none: 0, caution: 1, likelyDelays: 2 };

export function faaEventText(e: FaaEvent): string {
  switch (e.type) {
    case 'groundStop':
      return 'Ground stop';
    case 'groundDelay':
      return 'Ground delay program';
    case 'closure':
      return 'Airport closed';
    case 'delay':
      return e.maxMinutes ? `Delays up to ${e.maxMinutes} min` : 'Delays';
  }
}

export function combineImpact(faa: FaaInput | null | undefined, weather: StationWeather | null | undefined): CombinedImpact {
  const reasons: ImpactReason[] = [];
  const stamps: string[] = [];
  let level: WeatherLevel = 'none';

  if (faa?.status) {
    level = faa.status.level;
    for (const e of faa.status.events) reasons.push({ source: 'FAA', text: faaEventText(e), level: faa.status.level });
    if (faa.asOf) stamps.push(faa.asOf);
  }
  if (weather && weather.state === 'ok') {
    if (weather.asOf) stamps.push(weather.asOf);
    if (weather.level !== 'none') {
      if (RANK[weather.level] > RANK[level]) level = weather.level;
      for (const text of weather.reasons) reasons.push({ source: 'Weather', text, level: weather.level });
    }
  }
  if (level === 'none') return { level, reasons: [], asOf: stamps.length ? oldest(stamps) : null };
  reasons.sort((a, b) => RANK[b.level] - RANK[a.level]);
  return { level, reasons, asOf: stamps.length ? oldest(stamps) : null };
}

const oldest = (isoStamps: string[]): string =>
  isoStamps.reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a));

/**
 * Where to check weather for an itinerary (origin is not evaluated):
 * - each connection airport, from landing to the next departure;
 * - the destination, from arrival minus/plus `padMs` (default 1 h).
 */
export function weatherRequestsForItinerary(
  itin: Pick<Itinerary, 'legs'>,
  padMs: number = 60 * 60 * 1000,
): WeatherRequest[] {
  const legs = itin.legs;
  const out: WeatherRequest[] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    out.push({ station: legs[i].flight.to, fromMs: legs[i].flight.arriveUtc, toMs: legs[i + 1].flight.departUtc });
  }
  const last = legs[legs.length - 1];
  if (last) out.push({ station: last.flight.to, fromMs: last.flight.arriveUtc - padMs, toMs: last.flight.arriveUtc + padMs });
  return out;
}
