# live-flight-status

Flight status (AeroDataBox) for every result row (Q-047) and for the opened flight. Single GET and batch POST share one in-memory cache.

## Design (provisional, not John-decided; all numbers in `../_shared/flightStatusConfig.ts`)
- Shared in-memory cache keyed by flight number + date + origin. TTL by time to departure: >48h 6h, 24-48h 2h, <24h 30m, <3h 15m
  (never runs past the next tier boundary). Arrived or canceled flights: 30m.
- Upstream failure or non-200/404: serve the cached value with `stale: true`; 30 s backoff before asking again. No cache: 502.
- Usage (Q-049): NO app spend cap, no alert, no pause (the AeroDataBox plan bounds spend). Each UPSTREAM call logs one row in
  `api_usage` (provider, endpoint, units, month, ts); cache hits log nothing. If `api_usage` is missing or errors, status still
  works (logged once). Unit price and units per call are PLACEHOLDERS until the plan is chosen.
- Batch: duplicates (flight + date + origin) share one lookup; up to 8 upstream calls in flight at once. A failing item does not
  fail the batch: it comes back `state: "unavailable"` (or cached with `stale: true`).
- Rate limit: per IP, 30 requests/min and 120 lookups/min (a batch of N costs N; `lookupsPerMin` in the config), anon key
  through the gateway, CORS like the other functions.
- Dates accepted: 2 days back to 10 days ahead.

## Batch contract (the app uses this)
`POST /functions/v1/live-flight-status` with the same headers, JSON body `{ "flights": [ { "flight": "AA123", "date": "2026-10-22", "from": "ORD", "dep": 1761141600000 }, ... ] }`
(1 to 40 items; `from`/`dep` optional). Response `{ results: [...], asOf }`, one result per input position, in order:
`{ key: "AA123|2026-10-22|ORD", ...single response below }`. An invalid item yields `state: "invalid"` with an empty key.
400 bad body / empty / over 40, 429 rate limit. `fetchedAt` on each result is the age to show.

## Single contract
`GET /functions/v1/live-flight-status?flight=AA123&date=2026-10-22&from=ORD&dep=<departure epoch ms>` with `apikey` and
`Authorization: Bearer <anon key>`. `date` is the local departure date; `from` and `dep` are optional (leg pick, cache time).
```
{ flightNumber, date, state: "ok"|"not_found"|"unavailable", stale, paused /* always false, retired by Q-049 */, fetchedAt /* ISO, the age shown */,
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
