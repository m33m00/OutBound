# live-flight-status

Status for ONE flight the user opened or is traveling on (AeroDataBox). Never per search, never bulk (DECISIONS.md).

## Design (provisional, not John-decided; all numbers in `../_shared/flightStatusConfig.ts`)
- Shared in-memory cache keyed by flight number + date + origin. TTL by time to departure: >48h 6h, 24-48h 2h, <24h 30m, <3h 15m
  (never runs past the next tier boundary). Arrived or canceled flights: 30m.
- Upstream failure or non-200/404: serve the cached value with `stale: true`; 30 s backoff before asking again. No cache: 502.
- Spend: each paid call logs a row in `api_usage` (provider, endpoint, units, month, ts). Month sum >= alert ($24) logs a warning;
  the next call that would pass $30 is refused and the response is `state: "paused"` (cached value, `stale: true`, or none).
  If `api_usage` is missing or errors, status still works and usage is counted in memory only (a lower bound; logged once).
  Unit price and units per call are PLACEHOLDERS until the AeroDataBox plan is chosen.
- Rate limit: 20 req/min per IP (shared `allowRequest`), anon key through the gateway, CORS like the other functions.
- Dates accepted: 2 days back to 10 days ahead.

## Contract
`GET /functions/v1/live-flight-status?flight=AA123&date=2026-10-22&from=ORD&dep=<departure epoch ms>` with `apikey` and
`Authorization: Bearer <anon key>`. `date` is the local departure date; `from` and `dep` are optional (leg pick, cache time).
```
{ flightNumber, date, state: "ok"|"not_found"|"paused", stale, paused, fetchedAt /* ISO, the age shown */,
  status: null | { flightNumber, state: "scheduled"|"delayed"|"departed"|"arrived"|"canceled"|"diverted",
    departure|arrival: { airport, scheduledUtc, estimatedUtc, actualUtc, delayMin, terminal, gate }, providerUpdatedAt } }
```
400 bad params, 429 rate limit, 502 provider down and nothing cached.

## Deploy checklist (not done)
1. `supabase secrets set AERODATABOX_API_KEY=...`
2. Apply `supabase/migrations/20261021000000_api_usage.sql`.
3. Pick the plan; set `unitsPerCall`, `unitPriceUsd`, `upstream.baseUrl/hostHeader` (RapidAPI vs API.market) in the config.
4. Check one real response against `src/live/fixtures/flight-status-samples.ts` (hand-written from the docs, not a capture).
5. `supabase functions deploy live-flight-status`.
