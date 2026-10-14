# live-faa-status

Caches the FAA NAS status feed (`https://nasstatus.faa.gov/api/airport-status-information`, XML, no key)
and serves delays for requested airports.

Request: `GET /functions/v1/live-faa-status?airports=ORD,JFK` with headers `apikey` and `Authorization: Bearer <anon key>`.
Response: `{ asOf, fetchedAt, stale, airports: { ORD: { code, level: 'caution'|'likelyDelays', events: [...] } } }`.
Airports with no FAA event are simply absent. 429 when over 60 req/min per IP; 502 if FAA is down and nothing is cached.

All logic is in `../_shared/faaStatus.ts` (pure, tested by Jest in `src/live/__tests__`).
Cache is in-memory per function instance (5 min TTL, stale served on FAA error).

## Deploy (later)
1. Create the Supabase project (Free, US East). `npm i -D supabase` or install the CLI; `supabase login`.
2. `supabase link --project-ref <ref>` from the repo root.
3. `supabase functions deploy live-faa-status` (JWT verification stays on; the anon key is accepted).
4. Put the project URL and anon key in `.env` as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
5. Smoke test with curl, then restart Expo.
No secrets are needed for this function.
