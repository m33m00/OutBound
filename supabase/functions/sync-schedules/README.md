# sync-schedules

Fills `flight_schedules` from AeroDataBox FIDS departures (backlog 25; DECISIONS.md "Search": own schedule DB from daily
AeroDataBox pulls, no live calls per search). Pure logic and tests: `../_shared/schedules.ts`,
`src/live/__tests__/schedules.test.ts`. All numbers: `../_shared/scheduleConfig.ts`.

## Design (provisional, not John-decided; see Q-054)
- Airports = the app's airport table (12 today; a test keeps the config and `src/engine/airports.ts` in step).
- Each airport-day = 2 calls (00:00-12:00 and 12:00-23:59 local; AeroDataBox allows 12 h per call), departures only,
  operating carrier only (no codeshare copies), no cargo or private. Canceled flights stay (live status tags them).
- Only flights to another airport in the table are stored. Row id = airline + number + local date + origin, the engine's id.
- A day is replaced only when both windows answered (200, or 204 = no flights). Then flights the airline dropped are
  deleted. A failed day keeps yesterday's rows.
- Default run: days 0, 1 and 7 (72 calls). Old days (before today minus 2) are pruned every run.
- 1.1 s between calls. Every answered call logs one `api_usage` row. No spend cap (Q-049).
- Protected by the `SCHEDULE_SYNC_SECRET` header, not just the anon key, because every run costs units.

## Contract
`POST /functions/v1/sync-schedules?days=0,1,7&airports=DAL,DFW` with headers `Authorization: Bearer <anon key>` and
`x-sync-secret: <SCHEDULE_SYNC_SECRET>`. `days` takes a list or range (`0-7`, max 7); `airports` is optional (default all).
Response `{ calls, daysSaved, rowsSaved, failed: ["DAL 2026-10-30: upstream 429", ...] }`; 502 when nothing was saved,
403 wrong secret, 503 secret, AeroDataBox key or database env missing.

## Deploy checklist (not done)
1. Restore the Supabase project if it is paused.
2. Apply `supabase/migrations/20261030000000_flight_schedules.sql` (and the `api_usage` one if not yet applied).
3. `supabase secrets set AERODATABOX_API_KEY=...` (shared with live-flight-status) and `SCHEDULE_SYNC_SECRET=<long random string>`.
4. Check `unitsPerCall` and `upstream.baseUrl/hostHeader` in the config against the chosen plan.
5. `supabase functions deploy sync-schedules` and `supabase functions deploy live-schedules`.
6. Fill the search range once, a few airports per call so each run stays under the Edge Function time limit
   (4 airports x 8 days = 64 calls, about 75 s): `?days=0-7&airports=ATL,BNA,CLT,DAL`, then `DEN,DFW,LAX,LGA`, then `MIA,ORD,PHX,SEA`.
7. Check one real response against `src/live/fixtures/fids-departures-samples.ts` (hand-written from the docs, not a capture).
8. Schedule the daily run with pg_cron + pg_net (SQL editor; keep the secret out of git), for example 09:00 UTC:
   `select cron.schedule('sync-schedules', '0 9 * * *', $$ select net.http_post(url := '<project url>/functions/v1/sync-schedules', headers := jsonb_build_object('Authorization', 'Bearer <anon key>', 'x-sync-secret', '<secret>'), timeout_milliseconds := 150000) $$);`
   The default 72-call run takes about 90 s. If it times out, split it into two jobs by airport.
9. Set `EXPO_PUBLIC_SCHEDULES=live` in the app's `.env` and restart `npx expo start`.
