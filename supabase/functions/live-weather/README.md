# live-weather

Serves airport weather impact (Caution / Likely delays) from aviationweather.gov METAR + TAF. No API key.
Upstream: `https://aviationweather.gov/api/data/metar?ids=...&format=json&hours=3` and `/api/data/taf?ids=...&format=json`
(one batched call per product for all cache misses). Sends a custom `User-Agent`. aviationweather.gov limit: 100 req/min,
max 400 entries per call. We send at most 2 calls per cache miss, so we are far below it.

## Request
`GET /functions/v1/live-weather?stations=ORD:1760400000000:1760407200000,JFK` with `apikey` and `Authorization: Bearer <anon key>`.
Each station is an IATA code plus an optional window (UTC epoch ms, `from:to`) for when the traveler is there.
Bare code = now to +2 h. Max 40 per call. Use `weatherRequestsForItinerary()` in `src/live/impact.ts` to build them
(connection: landing to next departure; nonstop destination: arrival +/- 1 h; origin is never evaluated).

## Response
`{ fetchedAt, stale, results: StationWeather[] }`, one result per request, same order, `key = "ORD:from:to"`.
`StationWeather`: `state` (`ok` | `noForecast` | `noData`), `level` (`none` | `caution` | `likelyDelays`), `reasons` (short words, worst first),
`observedAt` (METAR time used), `issuedAt` (TAF time used), `asOf` (the older of those: show "updated 4m ago"),
`raw` (`ceilingFt`, `visSm`, `windKt`, `gustKt` behind the worst reading), `stale`.
`noForecast` = beyond the TAF ("no forecast yet", no badge, not an error). `noData` = unknown airport. 429 over 60 req/min per IP;
502 only if both sources fail with nothing cached.

## Rules (all numbers in `../_shared/weatherConfig.ts`)
Thresholds are John's Q-027. VFR / MVFR alone never shows a badge. Worst condition wins.
- Window start within 2 h of now: worst of the latest METAR (max age 3 h) and the TAF. Otherwise TAF only.
- TAF: base / FM / BECMG count as prevailing; TEMPO / PROB30/40 count at most as Caution, reason shown as "... (possible)".
- No NWS fallback (Q-028): a window outside the TAF's valid period is `noForecast`.
- Cache (in memory, per instance, per airport): METAR 5 min, TAF 15 min; expired data is served and flagged `stale` if upstream fails.
- Stations: ICAO = `K` + IATA, with an explicit map for Alaska / Hawaii / territories (`ICAO_EXCEPTIONS`).

Logic is in `../_shared/weather.ts` (pure; Jest tests in `src/live/__tests__/weather.test.ts` use saved fixtures only).

## Deploy (later)
1. Same Supabase project as `live-faa-status` (see its README for project / CLI setup).
2. `supabase functions deploy live-weather` (JWT verification stays on; the anon key is accepted).
3. Smoke test with curl, then restart Expo. No secrets needed.
