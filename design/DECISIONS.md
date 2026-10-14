# OutBound — Confirmed decisions (agent source of truth)

Condensed from the project docs: MVP decisions (through v8.8), design direction (through v9.1, 2026-10-10), plus John's updates on 2026-10-13 and 2026-10-14. Newest dated rule wins. Only John changes this file's rules; spec-keeper records them.

## Scope (updated 2026-10-13)
- Personal/friends project. No monetization planned for now.
- Minimum the app must do: route you where you need to go, with real-time flight status, airport traffic/delays and weather.
- Southwest policy review: no longer a hard gate for the friends beta (2026-10-13). Still true: no airline trademarks or logos, in-app "follow your airline's rules on sharing loads" notice stays.
- Real-time status, FAA delays and weather move up from v1.5 into the MVP (2026-10-13).
- Hard rule: no scraping airline websites or employee portals.
- Headline (Q-001, 2026-10-13): seat availability and live data (status, FAA delays, weather) are equal; both shown on every result row.

## Search
- 0–7 days out. Max stops 0–3, default 3. Connections min 60 min same airline / 90 switching; max layover 4h. All adjustable.
- Leave-by card airport buffer (Q-003, 2026-10-13): tester setting, default 75 min before departure.
  - Leave-by travel time (Q-023, 2026-10-14): uses phone location. Card is for the selected route's first leg, times in the departure airport's local time.
  - Provisional (v9.1 prototype details, John chose the approach): location requested only on "Use Location" tap (card) or "Use my location" toggle (settings), never at launch; location fresh for 20 min; within 400 km: drive min = round((km x 1.3 / 55 x 60 + 10) / 5) x 5; within 3 km: "You're at {AP}"; no fresh location or out of range: "Be at {AP} by {time}" with "{buffer} min before departure to list and clear security"; late on the day: "Leave now".
- Settings (Q-024, 2026-10-14), reached from the Profile button: airport buffer (default 75, step 5, range 30-180 provisional), "Use my location", and search defaults (max stops, same-airline and switching connection minimums, longest layover, nearby airports, longest ground transfer). The Filters panel starts from the saved defaults.
- Settings persistence (Q-025, 2026-10-14): saved on the phone (AsyncStorage) now; move to the account when login exists.
- Home airports (Q-026, 2026-10-14): one main home airport plus optional extra homes, set in Settings (Profile). Airports in the same nearby group as the main home (today DAL↔DFW, NEARBY_GROUPS) are added as homes automatically.
  - Search "From" starts at the main home.
  - "Get Home" button on search: shown when a main home is set and From is not one of your homes; sets To = main home and searches.
  - Map: home airports are amber house pins (main = filled pin, others = outline pins); amber stays "you" only.
  - Provisional (not John-decided): auto-added homes come from the engine's nearby groups, not a distance threshold; with no home set, search shows a hint to set one in Profile; marks are not tappable; label placement = generic right/left flip with overlap nudge; chevrons at t=0.2/0.66/0.88 per selected leg.
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
- FAA status to badge (Q-015, 2026-10-14): ground stop, ground delay program or airport closure = Likely delays (magenta); general arrival/departure delay under 60 min = Caution (violet); no FAA event = no badge.
  - General arrival/departure delay of 60+ min = Likely delays (Q-019, 2026-10-14). Under 60 min stays Caution. ~~Provisional, not John-decided (superseded 2026-10-14).~~
  - ~~Airport closures (Q-020, 2026-10-14): any closure the FAA lists shows Likely delays.~~ (closure rule superseded 2026-10-14 by Q-030). Still true: no filtering of future-dated closures (feed gives Start/Reopen without a year); early badges are accepted.
  - Airport closures (Q-030, 2026-10-14, John: A): FAA closures show Likely delays only when the whole airport is closed. Closures limited to private/GA, non-scheduled, or by-permission (PPR) flights, and runway/taxiway-only closures, are ignored. Ground stops, ground delay programs and general delays unchanged. (Trigger: LAX "AD AP CLSD TO NON SKED TRANSIENT GA ACFT ... until May 2027".)
- Provisional defaults for backlog item 3 (not John-decided; John may override): FAA cache TTL 5 min server-side; serve stale data on FAA error; one national NAS feed fetch, filtered on read; every value carries an as-of timestamp.
- Weather: aviationweather.gov METAR/TAF near departure, NWS further out; radar via RainViewer or NOAA MRMS (terms to confirm).
- METAR/TAF to badge (Q-027, 2026-10-14, John: A, ceilings + storms + wind + winter). VFR/MVFR alone never shows a badge. All thresholds live in one config file, tunable after testing.
  - Caution (violet): IFR (ceiling 500 to <1,000 ft or vis 1 to <3 mi); thunderstorm nearby (VCTS); gust >=30 kt or sustained wind >=25 kt; any snow/ice pellets or freezing precip (light); fog with vis <2 mi.
  - Likely delays (magenta): LIFR (ceiling <500 ft or vis <1 mi); thunderstorm at the airport; gust >=40 kt; moderate/heavy snow; any freezing rain/ice; vis <1/2 mi.
- Weather edge cases (Q-029, 2026-10-14, John adopted the recommendations; refines Q-027 where it differs, newest wins):
  - Freezing rain at any intensity = Likely delays. Freezing drizzle: light = Caution; moderate/heavy = Likely delays. ~~Q-027 "any freezing rain/ice = Likely delays" for drizzle (superseded 2026-10-14).~~
  - Ice pellets: light = Caution; moderate or heavy = Likely delays (build had moderate = Caution; build must change).
  - Blowing snow = Caution; the visibility rules still raise it if visibility drops.
  - Sustained wind >=40 kt without gusts = Likely delays (build must change). Sustained 25 to <40 kt stays Caution.
  - Airports with no known ICAO mapping (non-US other than HNL/ANC/SJU) = no weather badge for now.
- Forecast range (Q-028, 2026-10-14, John: A): no weather badge beyond the TAF window. NWS longer-range forecast can be its own later item.
- Provisional defaults for backlog item 5 (not John-decided; John may override):
  - G1: one Edge Function per source (live-faa-status as built; new live-weather) plus ONE client combining layer: worst of FAA and weather wins (Likely delays > Caution > none), reasons tagged by source, asOf = oldest input. useAirportStatus contract unchanged.
  - G2: stations: nonstop = destination; with connections = each connection airport plus final destination; origin not evaluated. Row badge = worst across stations. ICAO = 'K'+IATA in contiguous US, explicit map for others (HNL=PHNL, ANC=PANC, SJU=TJSJ). No data = no badge, not an error.
  - G3: time window: destination = scheduled arrival +/-1 h; connection = arrival to next departure. Within ~2 h of now, also use latest METAR (worst of observed and forecast). Beyond the TAF valid period = no badge (Q-028).
  - G4: cache METAR 5 min, TAF 15 min server-side; serve stale on upstream error and flag it; one batched request per station list; observed/issued timestamps on every value, shown as age in the app.
  - G5: rate limiting reuses item 3's per-client limiter for anon-key calls.
  - G6: response per station: level, short plain-word reasons, observed/forecast time, asOf, raw ceiling/visibility/wind values (for retuning thresholds), stale flag.
- Weather impact shows disruption only; Caution (violet) / Likely delays (magenta). Station = destination for nonstops, connection airport for connections.
- All third-party calls go through Supabase Edge Functions with caching. Keys server-side only.
- Edge Function access (Q-017, 2026-10-14): until invite-code login exists, live Edge Functions accept calls with the app's public anon key, with rate limiting. Require login once auth lands.

## Map
- Custom 3D globe: d3-geo + @shopify/react-native-skia behind a swappable map module; must run in Expo Go.
- Globe v1 (P0): land/ocean, state lines, colored arcs, tap to select, camera fly-to. Polish (P1): day/night, spin-in, flight preview, radar.
- Results: top 10 routes of current sort; overview in thin neutral gray; selected route in tier color per leg with direction chevrons; others faint ghosts; tap a ghost selects earliest-arriving option on that path.
- Line styles: solid = reported; dashed = estimate/typical/unknown. Legend only while a route is selected.
- Q-021 (2026-10-14): overview and ghost lines are always solid thin gray; solid/dashed styling applies only to the selected route (when the legend shows).
- Deselect (Q-018, 2026-10-14): tapping empty space while a route is selected deselects it (back to the all-gray overview) and pulls the camera back out.
- Chevrons scope (provisional, not John-decided): direction chevrons ship in backlog item 9; item 4 ships arcs without chevrons.
- Q-022 (2026-10-14): map line hit area 28pt = a tap within 28pt of a drawn line counts; if several routes are in range the selected route wins, otherwise the nearest. May be tightened after on-device testing.
- Camera fits the real route box above the panel.
- Removed: city lights, terrain, clock/time slider, weather key.

## Design system
- Ice Mix: Big Shoulders Display (uppercase) + Manrope. Primary ink blue #1D3D84 / #9BB8EF. Amber = "you" only; amber text #9A5200 / #FFC27A.
- Follows phone light/dark. Contrast ≥4.5:1; tier colors only as large numbers or fills.
- Tap targets ≥44pt. Spacing: 16 page, 12 section, 8 in groups, rows 10/12; radius 12/14/26.
- Buttons Title Case (Find Routes, Get Home); body sentence case. No tabs; top bar = wordmark, Requests pill, Profile.
- Airline badges: colored pill + plane glyph + IATA code. No logos.

### Theme tokens (confirmed 2026-10-13, Q-004/5/6; John may revise after seeing it on device)
Source in code: `src/theme/colors.ts`, `src/theme/typography.ts`. Values are light / dark.
- Surfaces: bg #f6f8fb / #0b1119; surface #ffffff / #111a25; surface2 #eef2f7 / #172231; line #dfe5ec / #1f2c3b; line2 #cbd4de / #2a3a4d.
- Text: text #101824 / #e8eef5; muted #56657a / #9cadc0; faint #606f84 / #8d9db0 (light faint darkened from prototype #66758a to pass 4.5:1, Q-006).
- Accent: #1d3d84 / #9bb8ef; onAccent #ffffff / #0a1530; accentSoft #e7ecf6 / #17233b.
- You (amber): you #c46a10 / #ffb25a; youText #9a5200 / #ffc27a; youBg #fcecd9 / #2c1d10.
- Tiers (mark | bg | text-on-bg), light then dark:
  - Wide open: #0b7f6a | #dcf3ee | #08594a / #2fd1b0 | #0d2a25 | #8ff0dc
  - Good: #1f9e6a | #e2f5ec | #11613f / #3bd08f | #10271d | #9af0c7
  - Okay: #7f9a1d | #eef4d8 | #4d5e0f / #c3d64a | #232a10 | #dbe98f
  - Tight: #c9861a | #fbf0dc | #7a4f08 / #f0b541 | #2a2313 | #ffd98c
  - Full: #d8474a | #fbe5e5 | #8f2426 / #ff6b6b | #2c1618 | #ffb9b9
  - Unknown: #8a94a6 | #eceff4 | #4c5568 / #8792a8 | #1c2230 | #b8c0d0
- Weather: Caution violet #5b4bd6 (bg #ebe8fd) / #b7adff (bg #201c40); Likely delays magenta #a3269a (bg #f9e2f6) / #f283e8 (bg #3a1533).
- Fonts: Big Shoulders Display 600/700/800; Manrope 400/500/600/700.
- Type scale (size/line height): title 29/32 Display, uppercase, tracking .02em; number 22/26 Display 800; wordmark 17/20 Display, uppercase, tracking .16em; heading 16/22 Manrope 700; body 14/20 Manrope 400; bodyStrong 14/20 Manrope 600; button 15/20 Manrope 700; small 12/16 Manrope 500.

## Tech
- Fresh project created 2026-10-13 on John's Mac with `create-expo-app@latest` (latest Expo SDK; 57 at time of writing) + TypeScript + Expo Router. The earlier Windows v0 codebase was a test and is not used.
- Dev machine: MacBook Pro (Apple silicon). iPhone via Expo Go; iOS Simulator optional.
- Supabase (Postgres, auth with invite codes, Edge Functions). iOS first via TestFlight.
- Supabase plan (Q-016, 2026-10-14): Free plan, US East region for the beta. Upgrade to Pro ($25/mo) before testers rely on it (free projects pause after a week idle). Pro is not in the Floor estimate below until then.
  - Region note (2026-10-14): the Supabase project was created in US West (Oregon, us-west-2), not US East as planned in Q-016. Edge Functions run at the edge, so they are unaffected; database region matters only once tables are added. Flag for John: recreate in US East before data lands, or accept US West?
  - Deployed 2026-10-14: live-faa-status and live-weather, to project bpiwqsdnngfdmrczpieb.
- Budget: Floor ~$9–18/mo + $99/yr Apple. Paid-API cap $30/mo, alert $24, estimates pause at cap.

## Not in the MVP
Boarding-pass scan, trip log, Watching, contributor priority, eligibility filtering, "from here" map, wayfinding, WN/DL/AS seat maps. Live aircraft positions (OpenSky) = P1.
