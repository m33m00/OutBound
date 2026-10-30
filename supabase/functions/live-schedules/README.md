# live-schedules

Serves stored flights (filled by `sync-schedules`) to the app's search engine (backlog 25). Reads our own
`flight_schedules` table only, never AeroDataBox, so it costs no upstream units. Client: `src/live/schedules.ts`.

## Contract
`GET /functions/v1/live-schedules?airport=DAL&from=<UTC ms>&to=<UTC ms>` with `apikey` and `Authorization: Bearer <anon key>`.
The window must be at most 5 days and inside the pulled range (2 days back to 11 days ahead).
```
{ airport, fromUtc, toUtc, pulledAt /* ISO, newest pull among the rows, null when none */, asOf,
  flights: [{ id, airline, flightNumber, from, to, departUtc, arriveUtc }] /* sorted by departure */ }
```
400 bad params, 429 rate limit (60 requests/min per IP), 502 database error, 503 env missing.

## Design (provisional, not John-decided)
- One search reads one window per airport it touches (origin, then each connection airport), so a 3-stop search on
  12 airports is at most 12 reads.
- In-memory cache per airport + window for 10 minutes on the server; the app keeps answers 15 minutes.
- Anon key + per-IP rate limit, like the other live functions (Q-017).
