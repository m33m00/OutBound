# live-drive-time

Drive time with traffic from your location to the departure airport, for the Leave By card
(John, 2026-11-01; he picked Apple Maps). Source: Apple Maps Server API `GET /v1/etas`
(free up to 25,000 calls a day with an Apple Developer Program membership).

Until it's set up it answers `{ "available": false, "reason": "not_configured" }`, and the app
keeps its rough straight-line estimate ("~25 min drive"). With it, the card says "32 min drive
with traffic".

## Contract
`GET /functions/v1/live-drive-time?from=lat,lon&to=lat,lon&depart=epochMs` with `apikey` and
`Authorization: Bearer <anon key>`. The app sends `from` at 3 decimals (about 100 m) and the server
rounds it again, so an exact address never reaches Apple. `depart` is when you'd leave (traffic for
that time); past or missing means now.
```
{ available: true, minutes, typicalMinutes, distanceKm, attribution: "Apple Maps", fetchedAt }
{ available: false, reason: "not_configured" | "no_route" | "upstream_unavailable" }
```
400 without `from` and `to`; 429 over 60 requests a minute per IP. Same trip within 5 minutes is
served from memory. Logic is in `../_shared/driveTime.ts`.

## Turning it on (John)
1. Join the Apple Developer Program (yearly fee) at developer.apple.com/programs.
2. In developer.apple.com/account: Certificates, Identifiers & Profiles > Identifiers > + > Maps IDs.
   Make one, e.g. `maps.com.outbound`.
3. Keys > + > name it "OutBound Maps", tick MapKit JS, Configure, pick that Maps ID, Continue,
   Register, then Download. The `.p8` file downloads once only; keep it safe and out of git.
   Note the Key ID on that page, and your Team ID (Membership details).
4. In Terminal, in the project folder:
   ```
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase secrets set APPLE_MAPS_TEAM_ID=YOUR_TEAM_ID APPLE_MAPS_KEY_ID=YOUR_KEY_ID
   npx supabase secrets set APPLE_MAPS_PRIVATE_KEY="$(cat ~/Downloads/AuthKey_YOUR_KEY_ID.p8)"
   npx supabase functions deploy live-drive-time
   ```
   The project ref is the part after `/project/` in your Supabase dashboard's address.
5. Push anything (or re-run "Publish to Expo Go"): the run summary's "Live functions" list shows
   `live-drive-time: HTTP 200` with `"available":true`.
