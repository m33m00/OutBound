# OutBound — Confirmed decisions (agent source of truth)

Condensed from the project docs: MVP decisions (through v8.8), design direction (through v9.1, 2026-10-10), plus John's updates on 2026-10-13. Newest dated rule wins. Only John changes this file's rules; spec-keeper records them.

## Scope (updated 2026-10-13)
- Personal/friends project. No monetization planned for now.
- Minimum the app must do: route you where you need to go, with real-time flight status, airport traffic/delays and weather.
- Southwest policy review: no longer a hard gate for the friends beta (2026-10-13). Still true: no airline trademarks or logos, in-app "follow your airline's rules on sharing loads" notice stays.
- Real-time status, FAA delays and weather move up from v1.5 into the MVP (2026-10-13).
- Hard rule: no scraping airline websites or employee portals.

## Search
- 0–7 days out. Max stops 0–3, default 3. Connections min 60 min same airline / 90 switching; max layover 4h. All adjustable.
- Nearby airports on: DAL↔DFW plus 3–4 metros testers fly; max ground transfer 60 min.
- Sort default: earliest arrival; tie-break fewer stops, then best availability. Full routes stay in time order, grayed with a red edge (2026-10-06). Best bet is an optional sort.
- Own schedule DB from daily AeroDataBox pulls (~30 airports). No live calls per search.

## Seat availability
- Source order: crowd report > AA/UA seat-map estimate (Duffel) > typical load (DOT T-100) > unknown.
- Tiers on net seats (open − listed): Wide open ≥50, Good 15–49, Okay 6–14, Tight 1–5, Full ≤0, Unknown.
- Typical loads are neutral: no tier word/color, don't affect route color or the Most seats sort.
- Route color = weakest leg (list); on the map, selected route keeps per-leg tier colors.
- Seat maps pulled only when a flight is opened; shared cache. TTL: >48h 6h, 24–48h 2h, <24h 30m, <3h 15m. Refresh with 2-min cooldown.
- Every value shows its age.

## Reports and requests
- Report = open seats + nonrevs listed, for a flight the app shows (no manual flight-number entry). Window: 7 days before to 2h after scheduled departure. Seats ≤ capacity; listed 0–250.
- Report screen: two big number fields with −/+ and a live result line (v9.1).
- Anonymous to other users, linked to the account behind the scenes.
- Requests: max 5 open per user; feed shows only your airline plus your own asks; push to same-airline testers (max 5/day, mutable) and to the requester on answer.
- At-airport shortcut (within ~4 km): "At DFW? Report a load" → departures → report.

## Real-time layer (2026-10-13)
- Flight status (AeroDataBox) only for flights a user opens or is traveling on.
- FAA NAS status (free) for ground stops, ground delays, airport delays.
- Weather: aviationweather.gov METAR/TAF near departure, NWS further out; radar via RainViewer or NOAA MRMS (terms to confirm).
- Weather impact shows disruption only; Caution (violet) / Likely delays (magenta). Station = destination for nonstops, connection airport for connections.
- All third-party calls go through Supabase Edge Functions with caching. Keys server-side only.

## Map
- Custom 3D globe: d3-geo + @shopify/react-native-skia behind a swappable map module; must run in Expo Go.
- Globe v1 (P0): land/ocean, state lines, colored arcs, tap to select, camera fly-to. Polish (P1): day/night, spin-in, flight preview, radar.
- Results: top 10 routes of current sort; overview in thin neutral gray; selected route in tier color per leg with direction chevrons; others faint ghosts; tap a ghost selects earliest-arriving option on that path.
- Line styles: solid = reported; dashed = estimate/typical/unknown. Legend only while a route is selected.
- Map line hit area 28pt. Camera fits the real route box above the panel.
- Removed: city lights, terrain, clock/time slider, weather key.

## Design system
- Ice Mix: Big Shoulders Display (uppercase) + Manrope. Primary ink blue #1D3D84 / #9BB8EF. Amber = "you" only; amber text #9A5200 / #FFC27A.
- Follows phone light/dark. Contrast ≥4.5:1; tier colors only as large numbers or fills.
- Tap targets ≥44pt. Spacing: 16 page, 12 section, 8 in groups, rows 10/12; radius 12/14/26.
- Buttons Title Case (Find Routes, Get Home); body sentence case. No tabs; top bar = wordmark, Requests pill, Profile.
- Airline badges: colored pill + plane glyph + IATA code. No logos.

## Tech
- Fresh project created 2026-10-13 on John's Mac with `create-expo-app@latest` (latest Expo SDK; 57 at time of writing) + TypeScript + Expo Router. The earlier Windows v0 codebase was a test and is not used.
- Dev machine: MacBook Pro (Apple silicon). iPhone via Expo Go; iOS Simulator optional.
- Supabase (Postgres, auth with invite codes, Edge Functions). iOS first via TestFlight.
- Budget: Floor ~$9–18/mo + $99/yr Apple. Paid-API cap $30/mo, alert $24, estimates pause at cap.

## Not in the MVP
Boarding-pass scan, trip log, Watching, contributor priority, eligibility filtering, "from here" map, wayfinding, WN/DL/AS seat maps. Live aircraft positions (OpenSky) = P1.
