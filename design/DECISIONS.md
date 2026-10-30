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
- Date row (Q-045, 2026-10-21, John): 4 chips only: Today, Tomorrow and the next two days. Later dates are reached through a calendar button. The 0–7 days limit is unchanged (calendar must not allow dates outside it).
- 0–7 days out. Max stops 0–3, default 3. Connections min 60 min same airline / 90 switching; max layover 4h. All adjustable.
- Leave-by card airport buffer (Q-003, 2026-10-13): tester setting, default 75 min before departure.
  - Leave-by travel time (Q-023, 2026-10-14): uses phone location. Card is for the selected route's first leg, times in the departure airport's local time.
  - Provisional (v9.1 prototype details, John chose the approach): ~~location requested only on "Use Location" tap (card) or "Use my location" toggle (settings), never at launch~~ (superseded 2026-10-21 by Q-051: one launch-time opt-in card, see Default origin); location fresh for 20 min; within 400 km: drive min = round((km x 1.3 / 55 x 60 + 10) / 5) x 5; within 3 km: "You're at {AP}"; no fresh location or out of range: "Be at {AP} by {time}" with "{buffer} min before departure to list and clear security"; late on the day: "Leave now".
- Settings (Q-024, 2026-10-14), reached from the Profile button: airport buffer (default 75, step 5, range 30-180 provisional), "Use my location", and search defaults (max stops, same-airline and switching connection minimums, longest layover, ~~nearby airports~~ (superseded 2026-10-21 by Q-048: replaced by the per-card Area toggle), ~~longest ground transfer~~ (removed 2026-10-21 by Q-052; per-area transfer minutes stay internal)). The Filters panel starts from the saved defaults.
- Settings persistence (Q-025, 2026-10-14): saved on the phone (AsyncStorage) now; move to the account when login exists.
- Home airports (Q-026, 2026-10-14): one main home airport plus optional extra homes, set in Settings (Profile). Airports in the same area as the main home (area table in `src/engine/airports.ts`; today DAL↔DFW) are added as homes automatically.
  - Search "From" starts at the main home (when location is off or unavailable; otherwise nearest airport, Q-051, 2026-10-21).
  - "Get Home" button on search: shown when a main home is set and From is not one of your homes; sets To = main home and searches. Always searches all airports in the home's area (Q-048, 2026-10-21).
  - Provisional (design round 3, 2026-10-30; not John-decided): the airport picker shows "Your airports" above "All airports" when nothing is typed: nearest airport (when location is on), then main home, then other homes, each with a small amber tag (Nearest / Main home / Home; amber = you). The airport being changed shows a check.
  - Map: home airports are amber house pins (main = filled pin, others = outline pins); amber stays "you" only.
  - Provisional (not John-decided): auto-added homes come from the engine's nearby groups, not a distance threshold; with no home set, search shows a hint to set one in Profile; marks are not tappable; label placement = generic right/left flip with overlap nudge; chevrons at t=0.2/0.66/0.88 per selected leg.
- ~~Nearby airports on: DAL↔DFW plus 3–4 metros testers fly; max ground transfer 60 min.~~ (superseded 2026-10-21 by Q-048: the "Nearby airports" filter is removed; see Airport areas)
- Airport areas (Q-048, 2026-10-21, John), backlog 22:
  - Area toggle at the top-right of the From and To cards, shown only when the airport belongs to an area. Off: outline gray pill "+ Area". On: solid accent-blue pill "All Dallas"; the card then lists every airport in the area in small wrapping text (e.g. LAX · BUR · LGB · SNA · ONT).
  - Areas = IATA metropolitan city groupings as major airlines use them, limited to cities with 2+ airports in the app's data (today only Dallas: DAL, DFW).
  - Toggle default off, then remembered per airport (last choice). Picker list shows airports only, no area rows.
  - Get Home always searches all airports in the home's area.
  - Supersedes the "Nearby airports on" default and the Q-012 candidate-metro list. NEARBY_GROUPS was replaced by the area table in `src/engine/airports.ts` (backlog 22).
- Default origin (Q-051, 2026-10-21, John), backlog 23:
  - Default origin = nearest airport to the user, however far. First launch shows the app's own card "Start searches from the airport nearest you?" with Allow / Not Now; the iOS location prompt appears only after Allow. Not Now = never asked at launch again; can be enabled in Profile.
  - Origin refreshes on app open if the saved location is older than 20 min; it never overwrites an airport the user picked while the app is open.
  - Location off: main home, else last searched origin, else empty with the existing hint.
  - Supersedes "Search From starts at the main home" when location is on.
- Missing-results display (Q-047, 2026-10-21, John), backlog 21:
  - No flights at all in the market that day: banner "No Flights Found on Selected Date", dismissible with X; no results panel opens.
  - Flights exist but filters hide all: banner like "3 routes hidden by your filters · Show Them", dismissible with X.
  - Departed flights are shown, mixed in by time. ~~Engine drops departed flights.~~ (superseded 2026-10-21 by Q-047)
  - Routes with a canceled leg stay in their normal time position.
  - Provisional, as built in backlog 21 (2026-10-21; not John-decided; John may override):
    - "Show Them" lists the routes filters hid using the loosest filter values (`LOOSE_FILTERS` in `src/search/useRouteSearch.ts`), for this search only; saved filters unchanged; note "Showing routes your filters hid, for this search only."
    - "No Flights Found" = zero routes even with the loosest filters.
    - Banners clear when date, From or To change, or on X.
- Row status tags (Q-050, 2026-10-21, John): Scheduled = no tag. "Delayed 25m" in violet (existing Caution color), old time struck through. Departed = gray tag and row dimmed. Canceled = red (existing most-severe delay color), time struck through. Amber stays "you" only.
  - A delay that breaks a connection shows a "Connection at risk" tag at the connecting airport.
  - Provisional, as built in backlog 21 (2026-10-21; not John-decided; John may override):
    - Arrived shown like Departed (gray). Diverted shown like Canceled, labeled "Diverted".
    - No live status = no tag and no dimming (never guess Departed from the schedule).
    - Connection at risk: only from live estimates, when the connection is below the min connection and below schedule; skipped once the onward leg has departed; never shown next to canceled/diverted.
    - Delayed time: old struck through, new shown once (top line for leg 0).
    - Dimmed row = gray fill/edge + muted time (not opacity, for contrast).
    - Canceled color open: Q-050 said "existing most-severe delay color" (magenta, likelyDelays) but also "red"; the only existing red is the Full seat tier. Built a dedicated red: light #c8102e / #fde0e3 / #9e0d24, dark #ff4d5e / #3a1018 / #ffa3ad, plus xmark.circle icon. See Q-053.
    - "Sample status" label while statuses are sample. While flights are sample data the app always uses sample statuses (`useFlightStatuses` with config null).
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
- ~~Flight status (AeroDataBox) only for flights a user opens or is traveling on.~~ (superseded 2026-10-21 by Q-047)
- Live status on every result row (Q-047, 2026-10-21, John). Each flight's status is fetched once into the shared server cache. Works with fixtures until the AeroDataBox key is added. Cost note: `design/research/flight-status-cost.md`.
  - App spend cap (Q-049, 2026-10-21, John): NO app spend cap for now ("we will address this later"). Usage logging (`api_usage`) stays. Fact: AeroDataBox flat plans below Mega have no overage, so the subscribed plan bounds spend.
  - Provisional, as built in backlog 21 (2026-10-21; not John-decided): Q-049 cap/alert/paused logic removed from server and UI, `api_usage` logging kept. Batch route POST `live-flight-status` takes up to 40 lookups per call; limit 120 lookups/min per IP.
- FAA NAS status (free) for ground stops, ground delays, airport delays.
- FAA status to badge (Q-015, 2026-10-14): ground stop, ground delay program or airport closure = Likely delays (magenta); general arrival/departure delay under 60 min = Caution (violet); no FAA event = no badge.
  - General arrival/departure delay of 60+ min = Likely delays (Q-019, 2026-10-14). Under 60 min stays Caution. ~~Provisional, not John-decided (superseded 2026-10-14).~~
  - ~~Airport closures (Q-020, 2026-10-14): any closure the FAA lists shows Likely delays.~~ (closure rule superseded 2026-10-14 by Q-030). Still true: no filtering of future-dated closures (feed gives Start/Reopen without a year); early badges are accepted.
  - Airport closures (Q-030, 2026-10-14, John: A): FAA closures show Likely delays only when the whole airport is closed. Closures limited to private/GA, non-scheduled, or by-permission (PPR) flights, and runway/taxiway-only closures, are ignored. Ground stops, ground delay programs and general delays unchanged. (Trigger: LAX "AD AP CLSD TO NON SKED TRANSIENT GA ACFT ... until May 2027".)
- Provisional defaults for backlog item 3 (not John-decided; John may override): FAA cache TTL 5 min server-side; serve stale data on FAA error; one national NAS feed fetch, filtered on read; every value carries an as-of timestamp.
- Weather: aviationweather.gov METAR/TAF near departure, NWS further out.
- Radar source (Q-031, 2026-10-14, John: A): NOAA MRMS via the NWS GeoServer WMS (free, keyless, public domain). ~~"RainViewer or NOAA MRMS (terms to confirm)" (superseded 2026-10-14).~~ Research: `design/research/radar.md`.
  - Provisional (not John-decided): be polite to NWS (respect refresh, request only needed regions, back off on failure); stale rule = show last frame with its age, hide overlay when older than 30 min (config); radar never feeds badge logic; no time slider, no color key; on/off toggle.
  - Radar default (Q-032, 2026-10-14, John: A): Radar overlay is on by default; the on/off map button's choice is remembered on the phone with the other settings (Q-025).
  - Provisional (main session defaults, not John-decided): app requests all four regions while radar is on (server only refetches from NWS when a frame changes, so NWS load does not grow with app users); toggle is a 44pt map button at the globe's top-right; caption "Radar 4m ago · NOAA/NWS"; overlay hidden past 30 min or when unavailable ("Radar unavailable").
  - Radar colors (Q-033, 2026-10-14, John: A): radar keeps NOAA's standard reflectivity colors (green, yellow/orange, red/magenta), unaltered. Home pins, route lines, marks and delay badges always draw above the radar so they stay distinct. "Amber = you only" and "magenta = Likely delays" apply to UI marks, not to the radar picture.
  - Provisional (not John-decided, tune on device): radar opacity light 0.6 / dark 0.5; first lever if route lines get lost is lowering light opacity to ~0.5. Caption "Radar 4m ago · NOAA/NWS"; full credit "Radar: NOAA/NWS MRMS" goes in a future About section.
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
- Provisional for backlog item 8, flight status (2026-10-21; main session defaults, not John-decided; John may override):
  - Function `live-flight-status`; shared cache keyed by flight number + date; ~~called only for flights the user opened or is traveling on~~ (superseded 2026-10-21 by Q-047: every listed flight, fetched once into the shared cache).
  - Cache TTL by time to departure: >48h 6h; 24-48h 2h; <24h 30m; <3h 15m. Client refresh cooldown 2 min. Serve stale on upstream error, flagged.
  - Fields: scheduled/estimated/actual times + delay minutes; departure and arrival gate + terminal; status (scheduled, delayed, departed, arrived, canceled, diverted); asOf + provider time.
  - Usage: `api_usage` table, monthly sum. ~~Schedule pulls count toward the same $30 cap (see Budget). Warn at $24; at $30 refuse new AeroDataBox calls and serve cached/stale data flagged "paused".~~ (cap, alert and pause superseded 2026-10-21 by Q-049; usage logging stays.) Unit price is a placeholder until the exact price is read from the plan page at signup.
  - UI: status shown as text in a flight-detail sheet opened by tapping a leg (still available; row tags added by Q-050).
- John-decided for backlog item 8 (2026-10-21):
  - ~~Canceled/diverted (and all flight status) is text only in the flight sheet; no row badge (Q-039, option A).~~ (superseded 2026-10-21 by Q-047 and Q-050: status shows on every row)
  - Provider plan: lowest paid AeroDataBox tier on API.market/RapidAPI (Q-040, option A). Unit price placeholder stays until read from the plan page at signup.
- All third-party calls go through Supabase Edge Functions with caching. Keys server-side only.
- Edge Function access (Q-017, 2026-10-14): until invite-code login exists, live Edge Functions accept calls with the app's public anon key, with rate limiting. Require login once auth lands.

## Map
- Custom 3D globe: d3-geo + @shopify/react-native-skia behind a swappable map module; must run in Expo Go.
- Globe v1 (P0): land/ocean, state lines, colored arcs, tap to select, camera fly-to. Polish (P1): day/night, spin-in, flight preview, radar (NOAA MRMS, Q-031, 2026-10-14; on/off toggle, no time slider or color key).
- Results: top 10 routes of current sort; overview in thin neutral gray; selected route in tier color per leg with direction chevrons; others faint ghosts; tap a ghost selects earliest-arriving option on that path.
- Line styles: solid = reported; dashed = estimate/typical/unknown. Legend only while a route is selected.
- Route legend (Q-044, 2026-10-21, John): one combined list replaces the separate tier color key and solid/dashed key. Rows read like "Good (Estimate)", "Good (Reported)"; each row's swatch is the tier color drawn in that row's line style. Line style rules unchanged (solid = reported; dashed = estimate/typical/unknown). Still shown only while a route is selected.
  - Provisional (spec-keeper pre-flight, not John-decided): list only the tier/source combinations that can occur; typical/unknown use the neutral Unknown color, dashed; row text uses theme text color, never tier colors; swatch is decorative, row is one accessible element with the full label.
- Q-021 (2026-10-14): overview and ghost lines are always solid thin gray; solid/dashed styling applies only to the selected route (when the legend shows).
- Deselect (Q-018, 2026-10-14): tapping empty space while a route is selected deselects it (back to the all-gray overview) and pulls the camera back out.
- Chevrons scope (provisional, not John-decided): direction chevrons ship in backlog item 9; item 4 ships arcs without chevrons.
- Q-022 (2026-10-14): map line hit area 28pt = a tap within 28pt of a drawn line counts; if several routes are in range the selected route wins, otherwise the nearest. May be tightened after on-device testing.
- Leg flight-time labels (Q-041, 2026-10-21, John: A): selected route only, a small subtle label on each leg's line, format "H:MM" (e.g. "2:35", no leading zero on hours; not "02:35" or "2h 35m"). Duration = arriveUtc - departUtc. Other route lines stay clean.
  - Provisional (spec-keeper pre-flight, not John-decided): backlog 15 defaults: label midpoint t=0.5 (chevrons sit at 0.2/0.66/0.88); non-interactive; text uses `muted` on a `surface` pill, never tier colors; hidden during flight preview; accessibility text "{FROM} to {TO}, flight time {h} hours {mm} minutes".
- Camera fits the real route box above the panel.
- Removed: city lights, terrain, clock/time slider, weather key.
- ~~Flight preview (Q-034/035, 2026-10-14, John: B + A): a plane flies the selected route and day/night shifts to the flight's scheduled times (a moving sky clock during the preview only; no user-controlled time slider). Started by a button only, never automatically.~~ (superseded 2026-10-30)
- Flight preview removed (2026-10-30, John: "We don't need a preview flight option in the app"): no Preview Flight button, no plane animation, no simulated sky clock. Day/night stays on real time; radar is never hidden for a preview.
- Spin-in (Q-036, 2026-10-14, John: A): plays on every app launch; skipped under Reduce Motion; any touch stops it.
- Day/night (Q-037, 2026-10-14, John: A): night shading + soft dusk + subtle sun glow. No sun disc, no labels.
  - Provisional (not John-decided): radar is hidden during a preview and restored after (radar is a "now" picture); preview labeled "Preview · {simulated local time}" so it never implies a live aircraft (live positions not in MVP); whole trip in one go with prototype timings; Reduce Motion disables preview with "Preview is off because Reduce Motion is on."; day/night recomputed at most about once a minute when idle; night drawn under radar. (Preview parts superseded 2026-10-30: preview removed; the day/night timing still applies.)
  - Provisional (not John-decided, 2026-10-14): a touch during the spin-in snaps to the final view (no freeze mid-spin).
  - ~~Provisional (2026-10-14): a tap that only stops a preview does nothing else (no select/deselect); drags still rotate.~~ (superseded 2026-10-30: preview removed)
  - Provisional (2026-10-14): spin-in plays once per app launch (per JS runtime); a remounted globe does not replay it. Clarifies Q-036 "every app launch".
  - Provisional (2026-10-14): sun highlight fades out near the globe's edge (prototype switched it off abruptly) to avoid a pop during preview.
  - Provisional (2026-10-14): dusk band peak alpha 0.13 (prototype value). Day/night drawn with a Skia RuntimeEffect shader; if it fails to compile, only the sun highlight shows.
  - ~~Provisional (2026-10-14): preview HUD shows simulated time in the phone's time zone ("Preview · 9:40 PM your time") with a progress bar and Stop. Refines the earlier "{simulated local time}" label.~~ (superseded 2026-10-30: preview removed)

## Design system
- Ice Mix: Big Shoulders Display (uppercase) + Manrope. Primary ink blue #1D3D84 / #9BB8EF. Amber = "you" only (UI marks, not the radar picture; Q-033, 2026-10-14); amber text #9A5200 / #FFC27A.
- Follows phone light/dark. Contrast ≥4.5:1; tier colors only as large numbers or fills.
- Tap targets ≥44pt. Spacing: 16 page, 12 section, 8 in groups, rows 10/12; radius 12/14/26.
- Buttons Title Case (Find Routes, Get Home); body sentence case. ~~No tabs; top bar = wordmark, Requests pill, Profile.~~ (superseded 2026-10-21 by Q-042)
- Bottom tab bar (Q-042, 2026-10-21, John): four tabs: Search · Feed · My Trips · Profile. Replaces the top-bar Requests pill and Profile button.
  - Feed = request feed (your airline's asks, per Reports and requests rules). My Trips = your own open requests (max 5) plus saved routes.
  - Saved routes = new concept, details open/provisional (Q-043). Feed and My Trips are placeholders until the requests backend exists.
  - Provisional: tab targets >=44pt; Settings still reached from Profile (Q-024).
  - Provisional (design round 1, 2026-10-30; not John-decided, John may override): Feed and My Trips show an empty-state card (icon, heading, one sentence, list of what will show there) until requests exist; My Trips offers Find Routes. Profile lists main home, other homes, airport buffer, location and search defaults as rows that open Settings, then an About group (Flights: Sample data, Airport delays: FAA, Weather: NOAA Aviation Weather, Radar: NOAA/NWS MRMS, Version) and the "Follow your airline's rules on sharing loads" notice.
- Filters button (Q-046, 2026-10-21, John): gets an SF Symbol icon (like the tab bar icons) so its purpose is clear at a glance. Label stays "Filters".
- Airline badges: colored pill + plane glyph + IATA code. No logos.
- Provisional (design rounds 2 and 10, 2026-10-30; not John-decided): every tappable dims while pressed; picking controls (date chips, area toggle, swap, max stops, steppers, radar, route select) give a light iOS selection haptic.
- Provisional (design round 11, 2026-10-30; not John-decided): the leave-by card (and, until 2026-10-30, Preview Flight) sit directly under the selected route's row and scroll with it (they used to sit above the list and could push the picked row out of the half-height panel); picking a route scrolls its row to the top and VoiceOver says the leave-by line once. Each leg's flight status is a VoiceOver action on the row. The row's stops line reads "1 stop · 5h 10m" because the route line above it already names the connections (VoiceOver still says "1 stop via DEN").
- Provisional (design round 12, 2026-10-30; not John-decided): at text sizes of 1.2x and up, the date chips go two to a row (calendar on its own row) instead of shrinking and cutting off "Tomorrow". The From/To label and the area pill share the card's top row, so they stop growing at 1.3x; the airport code, name and area list keep growing.
- Provisional (design round 13, 2026-10-30; not John-decided): when a search covered a whole area (Q-048, including Get Home), the results header adds a line under the date, e.g. "Landing at any Dallas airport (DAL, DFW)", because the title shows only the picked airports.
- Design review follow-ups (Q-056 to Q-059, 2026-10-30, John: "Go with your lean"):
  - Area pill matches Q-048: outline gray "+ Area" when off, solid accent-blue "All Dallas" when on.
  - Results let you change the date and the filters in place, without going back to search.
  - Results get a sort control; still the top 10 routes of the current sort; default stays earliest arrival.
  - Seat availability gets more visual weight on each result row (a route-level seat summary on the top line).
- Provisional (design round 14, 2026-10-30; not John-decided): Android and web show the closest Material icon wherever iPhone shows an SF Symbol (tab bar, buttons, chevrons, sheets), via `src/ui/Icon.tsx`; a symbol with no match keeps its text fallback.
- App icon (Q-055, 2026-10-30, John: A, "You design it"): Ice Mix ink blue (#1D3D84) background, white route arc from an amber origin dot (amber = you), white plane leaving up-right. Same mark on Android adaptive icon and favicon. Source `design/assets/make-icon.py`.
  - Provisional (design round 6, not John-decided): splash = OutBound wordmark (Big Shoulders 700, ink #1D3D84 / dark #9BB8EF) on the theme background (#f6f8fb / #0b1119).

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
- Supabase plan (Q-016, 2026-10-14): Free plan, ~~US East region for the beta~~ (US East part superseded 2026-10-21 by Q-038). Upgrade to Pro ($25/mo) before testers rely on it (free projects pause after a week idle). Pro is not in the Floor estimate below until then.
  - Region (Q-038, 2026-10-21, John: A): keep US West (Oregon, us-west-2) for the database; no recreate. Supabase has no US Central region (closest is us-east-2 Ohio). Supersedes the US East plan in Q-016.
  - ~~Region note (2026-10-14): project created in us-west-2, not US East as planned; flag for John whether to recreate in US East or accept US West.~~ (resolved 2026-10-21 by Q-038)
  - Deployed 2026-10-14: live-faa-status and live-weather, to project bpiwqsdnngfdmrczpieb.
- Budget: Floor ~$9–18/mo + $99/yr Apple. ~~Paid-API cap $30/mo, alert $24, estimates pause at cap.~~ (superseded 2026-10-21 by Q-049: no app spend cap for now; usage logging stays.)

## Not in the MVP
Boarding-pass scan, trip log, Watching, contributor priority, eligibility filtering, "from here" map, wayfinding, WN/DL/AS seat maps. Live aircraft positions (OpenSky) = P1.
