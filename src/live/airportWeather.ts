import type {
  LiveWeatherResponse,
  StationWeather,
  WeatherLevel,
  WeatherRequest,
  WeatherState,
} from '../../supabase/functions/_shared/weather';
import { weatherKey } from '../../supabase/functions/_shared/weather';
import type { Fetcher, LiveConfig } from './airportStatus';

export type { LiveWeatherResponse, StationWeather, WeatherLevel, WeatherRequest, WeatherState };
export { weatherKey };

/** Dedupes by key and sorts, so equal sets give the same hook key and URL. */
export function normalizeWeatherRequests(requests: readonly WeatherRequest[]): WeatherRequest[] {
  const map = new Map<string, WeatherRequest>();
  for (const r of requests) {
    const station = r.station.trim().toUpperCase();
    if (!station) continue;
    const n = { station, fromMs: Math.round(r.fromMs), toMs: Math.round(r.toMs) };
    map.set(weatherKey(n), n);
  }
  return [...map.values()].sort((a, b) => (weatherKey(a) < weatherKey(b) ? -1 : 1));
}

/** Calls the live-weather Edge Function. Throws on a non-OK response. */
export async function fetchAirportWeather(
  requests: readonly WeatherRequest[],
  config: LiveConfig,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<LiveWeatherResponse> {
  const list = normalizeWeatherRequests(requests).map(weatherKey).join(',');
  const url = `${config.baseUrl}/functions/v1/live-weather?stations=${encodeURIComponent(list)}`;
  const res = await fetcher(url, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } });
  if (!res.ok) throw new Error(`live-weather ${res.status}`);
  return (await res.json()) as LiveWeatherResponse;
}
