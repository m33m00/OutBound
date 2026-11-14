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
  - Provisional (v9.1 prototype details, John chose the approach): ~~location requested only on "Use Location" tap (card) or "Use my location" toggle (settings), never at launch~~ (superseded 2026-10-21 by Q-051: one launch-time opt-in card, see Default origin); location fresh for 20 min; within 400 km: drive min = round((km x 1.3 / 55 x 60 + 10) / 5) x 5; within 3 km: "You're at {AP}"; no fresh location or out of range: "Be at {AP} by {time}" with "{buffer} min early to list and clear security" (wording shortened 2026-10-30 so it fits on one line, see round 48); late on the day: "Leave now".
- Settings (Q-024, 2026-10-14), reached from the Profile button: airport buffer (default 75, step 5, range 30-180 provisional), "Use my location", and search defaults (max stops, same-airline and switching connection minimums, longest layover, ~~nearby airports~~ (superseded 2026-10-21 by Q-048: replaced by the per-card Area toggle), ~~longest ground transfer~~ (removed 2026-10-21 by Q-052; per-area transfer minutes stay internal)). The Filters panel starts from the saved defaults.
- Settings persistence (Q-025, 2026-10-14): saved on the phone (AsyncStorage) now; move to the account when login exists.
- Home airports (Q-026, 2026-10-14): one main home airport plus optional extra homes, set in Settings (Profile). Airports in the same area as the main home (area table in `src/engine/airports.ts`; today DAL↔DFW) are added as homes automatically.
  - Search "From" starts at the main home (when location is off or unavailable; otherwise nearest airport, Q-051, 2026-10-21).
  - "Get Home" button on search: shown when a main home is set and From is not one of your homes; sets To = main home and searches. Always searches all airports in the home's area (Q-048, 2026-10-21).
  - Get Home is the main button when it shows (Q-063, 2026-10-30, John: "Yes, make it main"): when you're away from home, Get Home is the filled blue button, right under From/To, and Find Routes turns into the lighter button beside Filters. At home, Find Routes stays the main button.
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
  - Route rows and the route card no longer show the "Leaves from DFW, 35 min from DAL" line (John, 2026-10-31: "I don't need to know how far it is from the airport I'm searching from"). The route line already names the airport; VoiceOver still says it.
- Default origin (Q-051, 2026-10-21, John), backlog 23:
  - Default origin = nearest airport to the user, however far. First launch shows the app's own card "Start searches from the airport nearest you?" with Allow / Not Now; the iOS location prompt appears only after Allow. Not Now = never asked at launch again; can be enabled in Profile.
  - Origin refreshes on app open if the saved location is older than 20 min; it never overwrites an airport the user picked while the app is open.
  - Location off: main home, else last searched origin, else empty with the existing hint.
  - Supersedes "Search From starts at the main home" when location is on.
- Missing-results display (Q-047, 2026-10-21, John), backlog 21:
  - No flights at all in the market that day: banner "No Flights Found on Selected Date", dismissible with X; no results panel opens.
  - The no-flights banner adds a "Try Tomorrow" button that searches the next day (Q-073, 2026-10-30, John, option B). Provisional wording (not John-decided): when the search was for a later day it reads "Try {weekday}", e.g. "Try Saturday"; hidden on the last searchable day (7 days out).
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
    - ~~"Sample status" label while statuses are sample.~~ (superseded 2026-10-30: sample labels removed, see Design system) While flights are sample data the app always uses sample statuses (`useFlightStatuses` with config null).
- ~~Sort default: earliest arrival; tie-break fewer stops, then best availability. Full routes stay in time order, grayed with a red edge (2026-10-06). Best bet is an optional sort.~~ (superseded 2026-10-30)
- Sort default (2026-10-30, John: "Flight options should be sorted by departure time. It's weird seeing some earlier flights listed later. If a flight already departed it should be at the top and grey'd out"): departure time, earliest first. Routes that already left sit at the top, grayed. Full routes stay in time order, grayed with a red edge.
  - Provisional (design round 19, not John-decided): ties go to earlier arrival, then fewer stops, then best availability. "Already left" for graying and floating to the top means live Departed/Arrived on the first leg (Q-050: never guess Departed from the schedule); see Q-061. A departed row's seat chips keep their words but drop tier colors.
  - Provisional (design round 19, not John-decided): the list is still 10 routes. When more than 10 match, it keeps at most the 3 that left most recently (by schedule) and fills the rest with routes still to leave, so a late-day search isn't all gone flights (`pickResults` in `src/engine/search.ts`); see Q-061.
  - Provisional (design round 20, not John-decided): when routes that already left sit above routes still to go (today's searches), a thin accent "Now · 9:40 PM" line (origin time) separates them.
- Results take over (Q-062, 2026-10-30, John: "Results take over"): after Find Routes the panel opens near full height with a compact fixed header and slim rows so about 6 routes show; tapping a route drops the panel to half so the globe shows it, and the row opens into a route card (legs, seats per leg, connection, leave-by, live status).
  - Provisional (design round 21, not John-decided): fixed header = "‹ Search", route title and Filters on one line, then the day stepper with the route count and sample labels; area and "showing hidden routes" notes scroll with the list. Slim row = times + seat summary + badge, route + stops + duration, airline pills with any live tag or connection risk. The route card adds per-leg seat chips (tappable for flight status), "Connect at DEN · 1h 30m" lines and the leave-by card. Tapping the open card closes it and the list goes back to near full; Back returns the search panel at half. An empty search drops the panel to half for its banner. The sheet handle is 28pt tall with hit slop (still a 44pt target).
- Picked route (2026-10-30, John: "it's still hard to see down below" and "the Leave By pill should sit at the top", clarified "Leave By pill I mean"): the Leave By card sits at the top of the picked route, above the flight summary.
  - Provisional (design round 22, not John-decided): a picked route gets its own view in the panel instead of expanding inside the list: "‹ Routes", route title and "‹ 2 of 8 ›" to flip routes; then the Leave By card, then the route card in body-size type. The panel takes 56% of the screen body while a route is open (48% otherwise), so the globe keeps the larger share. The list stays mounted underneath and comes back at the route you had open.
  - Provisional (design round 22, from design review): the slim row's seat summary shows its age ("Reported 5m ago", from the leg that sets it); a route with only typical loads shows the neutral "Typically ~12 open · Jul data" in place of the summary; the slim row adds connections under 60 min ("1 stop · 45m at DEN"); at text sizes 1.3x and up the results bar shows Back and Filters as icons and the route title can wrap to two lines; VoiceOver reads the title as "DFW to LAX". The sheet handle is back to 44pt tall.
- Day switcher across the results panel (2026-10-30, John: "Can it fit across page instead of being on the left side?"): the results day switcher runs the full width of the panel, back arrow at the left edge, the date in the middle, forward arrow at the right edge.
  - Provisional (design round 23, not John-decided): the route count sits under the date inside the switcher ("Fri, Oct 30" over "8 routes"); the arrows are full-height 44pt targets; sample labels sit on their own centered line under it.
  - Provisional (design round 23, from design review): in the route view the route card no longer closes on a tap (only "‹ Routes" closes it) and drops its blue selected tint, so the Leave By card leads; the route view keeps the sample labels; flipping routes re-reads the Leave By line to VoiceOver; the "‹ 2 of 8 ›" arrows get 4pt of extra hit area. The Leave By card's Use Location / Open Settings button is outlined in blue on white and sits at the end of the time row (own row from 1.3x text size). On Search, Filters and Find Routes sit right under From/To so they show without scrolling; the "Sample flights" label moves to the top bar; the panel opens tall while the "Use your location" card shows.
- Provisional (design round 24, 2026-10-30; not John-decided): every page sheet (Filters, Date, airport picker, flight status, delays and weather) shares one header: the title on the left and an iOS-style blue text button on the right, "Done" in bold, or "Cancel" in regular weight on the airport picker, instead of a filled Done button that competed with the sheet's own buttons. In the route view, VoiceOver users can swipe up or down on "2 of 8" to flip routes; the arrows stay for Voice Control.
- Provisional (design round 25, 2026-10-30; from design review, not John-decided):
  - The empty-search notice (Q-047) sits at the top of the search panel, above the dates, so half height always shows it (it used to sit under Find Routes, and the Get Home row pushed it out of view).
  - ~~The row's delay badge names the worst airport: "Likely delays · ORD · 4m ago".~~ (superseded 2026-10-30 by Q-072)
  - When live status moves the arrival at the end of the route by 5+ min, the row strikes the scheduled arrival and shows the expected one, like a late departure.
  - Get Home says where it goes: "Get Home · Dallas" (area city, since it always searches the whole area) or the home's code when it has no area.
  - "You're at DFW" on the Leave By card is amber (amber = you), not the Good tier green, which means seats.
  - The flight status sheet says "Departed", matching the row tag (Q-050), instead of "In the air".
  - Settings' reset is now "Reset All Settings" and asks first, since it clears your homes.
  - Tapping the panel handle at full height steps down one size instead of jumping to the smallest.
- Settings reset (Q-064, 2026-10-30, John: "Clear everything"): "Reset All Settings" clears everything on the phone, homes included, after a confirm.
- ~~Seat numbers (Q-065, 2026-10-30, John: "I'd rather see both numbers"): seat text shows open seats and nonrevs listed, not only the net figure: "Tight · 20 open · 17 listed" on the row's seat summary and on each leg in the route card. The tier still comes from net seats (open minus listed). Readings without both numbers fall back to "3 open". Typical loads keep "Typically ~51 open".~~ (changed 2026-10-31 by John: cards show just the chance word; both numbers move to the flight's sheet, see Route card A)
- Search starts with To blank (Q-069, 2026-10-30, John: "Start it blank"): no airport is picked for you; To shows "Choose airport" like From until you pick one. Get Home still fills To with your main home.
- Leave By with a delayed flight (Q-070, 2026-10-30, John: "C"): the card still counts back from the scheduled departure, and adds "Flight delayed to 2:40 PM" under it when live status has a new time. No delay line once the flight has departed.
- Notification switches before push (Q-071, 2026-10-30, John: "1A"): Settings keeps both switches, and the section's footer starts "Notifications start once requests go live."
- Row delay badge (Q-072, 2026-10-30, John: "2C"): the badge on a result row stays on the top line as just the word with its icon ("Likely delays" or "Caution"). The airport, reasons and age are in the delays and weather sheet the badge opens; the row's VoiceOver label still says them.
- Today's list opens at the "Now" line (Q-066, 2026-10-30, John: "Yes"): when routes that already left sit at the top, results open scrolled so the "Now" line is at the top; the routes that left are a short scroll up. Once you scroll or pick a route, the list stays where you put it.
- Provisional (design round 26, 2026-10-30; accessibility pass, not John-decided):
  - Dark mode contrast checked for every text/fill pair in use; all pass 4.5:1 (weakest: Tight chip 6.31:1 light). Keep faint text off accentSoft (4.32:1).
  - From 1.3x text size the row's seat chip and delay badge sit left-aligned under the times; long seat text and badges wrap inside their pill instead of being cut off; times never split between the number and AM/PM.
  - VoiceOver hears words, not shorthand: "4 hours 20 minutes", "5 minutes ago", "estimated", "about", "DAL to PHX to LAX". Delay and flight status cards each read as one sentence.
  - Flight status and delay cards wrap their top line at big text sizes; airport names on Search get two lines; the radar caption is hidden from VoiceOver on iPhone too.
- Own schedule DB from daily AeroDataBox pulls (~30 airports). No live calls per search.

## Seat availability
- Source order: crowd report > AA/UA seat-map estimate (Duffel) > typical load (DOT T-100) > unknown.
- Tiers on net seats (open − listed): Wide open ≥50, Good 15–49, Okay 6–14, Tight 1–5, Full ≤0, Unknown.
- Seat labels (Q-074, 2026-10-30, John: "Lets go with your recommendation"): the tiers show as your chances of getting on: Easy (≥50), Likely (15–49), Maybe (6–14), Long shot (1–5), Full (≤0). Chip: "Likely · 46 open · 2 listed". Typical loads read "Usually ~1 open · Oct avg" (was "Typically ~1 open · Oct data"). Tier thresholds, colors and numbers are unchanged; the words apply everywhere (rows, route card, map legend, flight sheet, Report Load, requests, VoiceOver). Older lines here that quote Good, Tight, etc. mean the same tiers.
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
- Flick to spin and drift home (2026-10-30, John: "I want to be able to spin the globe and it spins smoothly and eventually slowly resets back to your location").
  - Correction (2026-10-30, John: "No it should keep spinning back to place once I stop. Like don't let the globe stop and then reset back. It should naturally after slowing down reset back."): one continuous motion from letting go to home, with no stop or pause in between.
  - ~~Provisional (design round 30): coast to a stop, wait 4 seconds, then glide back.~~ (superseded by John's correction)
  - Provisional (design round 31, not John-decided, John may override): letting go of a drag starts the return at once, at the finger's speed, slowing smoothly until the globe rests on home (one curve, no stop). A hard flick spins round in the direction thrown and lands on home after however many turns fits its speed; a gentle release eases straight back (about 1 to 3 seconds). A flick away from home that wouldn't reach it eases out, turns and settles back, like a spring, without pausing. Zoom comes back with it. "Home" is your From airport (the nearest airport when location is on, else main home) when nothing is searched, and the routes overview when results are listed; the globe rests there at launch too (continental US only when there's no From). With a route open the globe coasts to a stop and stays where you put it. After a pinch it glides home after 4 seconds still. Any touch stops the motion. Reduce Motion: no coasting; the globe jumps home after 4 seconds still. If your location arrives during the spin-in, the spin lands on it instead of being cut short.
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
- Route card A (John, 2026-10-31, from the design audit: picked A, "and just the word"):
  - The route card leads with one headline. A live problem leads, worst first: a canceled or diverted flight ("PHX → LAX canceled"), a connection at risk ("Connection at risk at PHX"), the first flight gone ("Departed"), then delays ("DFW → PHX delayed 40m", or "2 flights delayed"). With nothing live wrong, the route's chance word leads ("Likely").
  - Cards (the route card and the list rows) show just the chance word. The open and listed numbers, with their age, show in the flight's sheet under Seats.
  - Under the headline: the times (new time big, old time small and struck) with stops and duration, then one line per flight: departure time, airports, at most one live tag, and the flight. Seats per flight open with the flight's sheet. Connections read "1h 30m at DEN" (plus "change airlines"); a connection at risk adds an "At risk" tag there.
  - One seat age per card at the bottom ("Seats reported 5m ago"); when a live problem leads, it also says the chance word ("Seats: Likely · reported 5m ago").
- Logbook tab (John, 2026-10-30: "A tab to track your flight history", picked A): a fifth tab, Logbook, between My Trips and Profile. Totals up top (flights, miles, airports), then your flights by month. Add a flight by scanning the boarding pass barcode, picking a screenshot of one, or typing it in. A map of where you've been can follow later. Provisional details (not John-decided, John may override): the logbook stays on the phone only; from a pass only the flight is kept (airline code, flight number, airports, day, seat), never the name or booking code; a scan or screenshot fills the form so it's checked before it's added, and a pass with more than one flight adds them all; the same flight on the same day logs once; miles are straight-line distance between airports; removing asks first. On iPhone a screenshot can only be read when the pass uses a square QR code (the phone's barcode reader limit), so a miss says to scan the pass with the camera (a pass on another screen works) or type it in.
  - Provisional (design round 60, not John-decided, John may override): in Add Flight, the keyboard's return key moves to the next box (Airline, Flight, From, To, Seat) and Go on Seat adds the flight; a full From code moves on to To by itself while To is empty. From 1.3× text the boxes and the two add buttons go one per line.
  - Provisional (design round 61, not John-decided, John may override): tapping a logged flight opens it as Edit Flight, filled in, to fix any detail (say a scan picked the wrong year). Save Changes keeps its place in the list; it can't be changed into a flight that's already logged. The scan and screenshot buttons only show when adding.
  - Provisional (design round 62, not John-decided, John may override): once there are two flights or more, the totals card adds two small lines under the numbers: your most flown airport ("Most flown: DFW · 12 flights", only when an airport is in two flights or more) and your longest flight ("Longest: DFW → HNL · 3,784 mi"). Ties go to the one logged first.
  - Provisional (design round 63, not John-decided, John may override): a flight's status sheet (from Search or My Trips) shows Add to Logbook from two hours before it leaves. One tap logs it on its day at the departure airport; then it reads "In your Logbook" with a check.
  - Provisional (design round 65, from the design audit, not John-decided, John may override): explainer lines that don't change what you'd do are cut: "Times are local to each airport" on the flight sheet, the miles note in the Logbook footer (it keeps "Your logbook stays on this phone."), "Opening a route searches its day again" in My Trips, the request footer keeps only "1 of 5 requests open", Feed's footer is "People who ask see the numbers, never who answered.", and Settings' Location footer keeps only "Only used while the app is open." (the switch already says what it's for).
  - Provisional (design round 67, from the design audit, not John-decided, John may override): the flight sheet's age line and Refresh share one line. In the Seats card, Report Load and Ask for Load sit side by side (stacked from 1.3x text); the "Seen the board?" prompt is gone; under the buttons only the notes that say why a button is off or what happens next, and the privacy line reads "Ask employees at this airline. They won't see who asked."
  - Provisional (design round 69, from the design audit, not John-decided, John may override): the Leave By card drops its icon tile, so its lines get the full width; the chevron always shows while the card opens directions, even beside Use Location.
  - Provisional (design round 70, from the design audit, not John-decided, John may override): the My Trips and Logbook empty states drop their bullet lists for one line each: "Routes you bookmark in Search and answers to your load requests show up here." and "Scan a boarding pass, pick a screenshot of one, or type a flight in."
  - Provisional (design round 71, from the design audit, not John-decided, John may override): a saved route whose day has passed shows a gray Passed tag beside its day and times instead of the sentence "Your saved day has passed. Opens today’s search."; VoiceOver still says "Day passed. Opens today’s search."
  - Provisional (design round 72, from the design audit, not John-decided, John may override): the Feed empty state matches My Trips and Logbook with one line: "Asks about your airline’s flights show up here for you to answer."
  - Provisional (design round 73, from the design audit, not John-decided, John may override): the Notifications footer in Settings drops the middle sentence that repeated the switch captions; it reads "Notifications start once requests go live. Nobody sees who asked or who answered."
  - Design round 74 (John, 2026-11-01: "move the AA flight number to the right of the delayed pill and the connection time aligned center between both flights and mention it’s a connection"): in the route card each leg's live tag and flight chip stay together, the chip to the right of the tag; when they don't fit beside the time and airports they wrap under them as one piece, right-aligned. The line between legs reads "2h 40m connection at PHX". Design round 75 (John, 2026-11-01: "The connection should be center to the line drawn vertically between both flights"): the timeline line runs dot to dot, and the connection label sits beside it, left-aligned, at the middle of that line; when the leg above wraps, matching space goes under the label so it stays at the middle.
  - Design round 76 (John, 2026-11-01: "Move the departure delay pill and airline/flight number on top of the departure time and the arrival delay pill and airline/flight number below the arrival time"): in the route card the first flight's tag and flight chip sit on their own line above its time and airports, and every later flight's sit on their own line below, left-aligned, so the connection between flights stays clear. Supersedes round 74's "beside the time, wrapping as one piece"; the chip still sits right of the tag.
  - Design round 77 (John, 2026-11-01: "Those pills should be all the way to the left aligned with the dots and the arrow to expand should be to the right of the marker"): those tag and flight lines start at the dots' left edge, and the chevron sits right after the flight chip. Under a middle flight of a two-stop route the line runs on to the next connection, so there the pills keep clear of it.
  - Provisional (design round 78, from the design audit, not John-decided, John may override): the Leave-by footer in Settings keeps only "Time to list and clear security."; the sentence about tapping the card for directions goes, since the card's chevron shows it.
  - Design round 79 (John, 2026-11-01: "for the search button and anything that is like a button to go back or forward ... make that look like a button"): every control that moves you back or forward or closes a sheet is a real button shape, never a bare word. A small capsule (36pt tall, 44pt to tap): Back ("‹ Search", "‹ Routes", "‹ Back") and Cancel in a soft blue tint; Done filled blue (sheet headers and the keyboard bar); Try Tomorrow, Show Them, Refresh and Cancel Request as soft capsules; the route and day arrows as round soft buttons.
  - Design round 80 (John, 2026-11-01: "each individual flight should be like its own container. So people know ... it's easier right off the bat to click that to expand rather than putting an arrow, like a caret"): in the route card each flight is its own tinted box (surface2, small radius, 44pt minimum) and the whole box opens that flight's status; the chevron is gone. The timeline line and dots stay down the left, each dot centered on its box; inside the box the first flight's tag and flight chip sit above its time and every later flight's below (round 76 kept). The connection label stays beside the line, at the middle between the two dots. Supersedes round 77's tag and chip lining up with the dots and its caret beside the chip.
  - Live data in Expo Go (John, 2026-11-01: "Yes, wire it in"): the Expo Go publish passes the SUPABASE_URL and SUPABASE_ANON_KEY repository secrets in as EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, so radar, airport delays, weather and flight status use real data there. The app reads each public value by name (PUBLIC_ENV in src/live/airportStatus.ts) because Expo only bakes in process.env.EXPO_PUBLIC_NAME read directly. Each publish checks live-radar, live-faa-status and live-weather and lists their answers in the run summary.
  - Design round 81 (John, 2026-11-01: "the Market at the top next to the save button is not aligned in the center ... feels like we're trying to fit too much in that row. Can we have the Save button in the container with the flight summary on the top right"): Save moves out of the route view header into the route card, top right beside the headline. The header is Back, the route, then the route pager. Both result headers (list and route view) now center the route on the screen: the left and right controls are measured and both sides take the wider width (CenteredTitleRow).
  - Design round 82 (John, 2026-11-01: "The Leave By small annotation underneath should pull the estimated time to drive there from your location"; picked Apple Maps over Mapbox and Google Maps): Leave By asks the new live-drive-time function for the drive with traffic, leaving around the rough leave time; the line then reads "32 min drive with traffic · at DFW by 7:45 AM" and the leave-by time uses it. Until Apple answers (not set up, not deployed, offline) the card keeps the rough straight-line guess with its "~". The phone's location goes out rounded to about 100 m. Apple Maps Server API needs John's Developer membership, a MapKit key and one deploy (supabase/functions/live-drive-time/README.md).
  - Design round 83 (John, 2026-11-01: "I don't like the weather button toggle on the home page. That should just be in the settings"): the radar button over the map is gone. Rain radar is a switch in Settings under a new Map section ("Live rain on the globe, from NOAA"), on by default as before. The radar age caption went with the button.
  - Design round 84 (John, 2026-11-01: "I don't like the way the dates across the top are like Tue 2, Wed 3 ... The font size is also not consistent"): every date chip on Search has the same two lines at fixed sizes: a small word on top (Today, Tomorrow or the weekday, e.g. Fri) over the date in bold ("Nov 6"). No chip shrinks its text to fit. A later day picked from the calendar shows the same way in the calendar chip. The results day stepper keeps "Fri, Nov 6".
  - Design round 85 (John, 2026-11-01: "Can you make the route lines pulse slowly animated in the direction"): every route arc on the globe carries a soft white stretch that slides slowly from origin to destination (2.6 s a leg); on a connection it runs leg by leg as one trip, then rests 1.2 s. Brighter on the picked route, fainter on the others. Off with Reduce Motion and while the globe is dragged or flying. Read "route lines" as the globe arcs, not the route card's timeline line.
  - Feed = request feed (your airline's asks, per Reports and requests rules). My Trips = your own open requests (max 5) plus saved routes.
  - Saved routes (Q-043, John 2026-10-30, option A): save from a route in Search; kept on the phone; no limit; opening one re-runs the search for its date. Feed is a placeholder until the requests backend exists.
    - Provisional (design round 27, 2026-10-30; not John-decided, John may override): Save Route is a bookmark in a picked route's header, beside the route counter, filled once saved (tap again to remove). My Trips lists saved routes as cards (path, day and times, flight numbers) with a trash button that asks first; coming trips first by departure, then days that passed. Opening one switches to Search, runs that day's search with the saved airports and area choices, and opens the same flights (matched by airline, flight number and airports), from the routes your filters hid if need be; if they're gone, the list shows with a note. Once its day has passed it opens today's list with a note instead, and the card says so. Settings' reset doesn't touch saved routes (they aren't settings).
    - Provisional (design round 28, 2026-10-30; not John-decided): saved routes show a small blue bookmark before the route line in the results list, and VoiceOver adds "Saved to My Trips" to the row. Saving or removing from the header bookmark is announced to VoiceOver. My Trips cards say Today or Tomorrow instead of the date when that fits (counted at the origin).
  - Provisional: tab targets >=44pt; Settings still reached from Profile (Q-024).
  - Provisional (design round 1, 2026-10-30; not John-decided, John may override): Feed and My Trips show an empty-state card (icon, heading, one sentence, list of what will show there) until requests exist; My Trips offers Find Routes. Profile lists main home, other homes, airport buffer, location and search defaults as rows that open Settings, then an About group (Flights: Sample data, Airport delays: FAA, Weather: NOAA Aviation Weather, Radar: NOAA/NWS MRMS, Version) and the "Follow your airline's rules on sharing loads" notice.
  - Provisional (design round 29, motion and navigation audit, 2026-10-30; not John-decided, John may override):
    - Motion: the results panel uses one no-bounce spring for every size change (tap, drag, app). Search and results cross-fade (180 ms). A picked route slides in a little from the right like an iOS push; flipping routes fades the card and starts it at the top; the list fades back in. The globe glides with the panel (350 ms) instead of snapping. Reduce Motion: no slides or glides, fades only.
    - Back: one step at a time everywhere: route, then list, then search. Android's back button and re-tapping the Search tab walk these steps (iOS pop-to-top). Tapping empty globe closes a route the same way as "‹ Routes".
    - Sheets keep their title and content while they slide away. Filters' Done re-runs the search only when something changed, and keeps an open route open. Opening a saved route goes straight to the route view's height.
    - VoiceOver lands on the route title when a route opens and on the list title when you go back. Globe route taps and airport picks tick like row taps. Return in the airport search picks the top match.
  - Re-tapping the Search tab steps back one level (2026-10-30, John: "Feels right").
  - No sample or placeholder labels (2026-10-30, John: "Can you remove all the sample data placeholder stuff. I really just want an idea of what this app will look like"). Supersedes the "Sample status", "Sample flights", "Sample delays" and Profile "Flights: Sample data" labels above.
    - Provisional (design round 30, not John-decided, John may override): every sample/demo label, chip, note and disclaimer is gone (top bar, results header, route view, flight status and delays sheets, Profile's Flights row while flights are sample, the "Data from AeroDataBox" line on sample statuses). The sample flights, seats, statuses and delays themselves stay so screens show what the app will look like; without a flight schedule source there would be nothing to show. Feed's empty state reads as a quiet day ("No requests right now"), not as a feature that isn't built.
  - Provisional (design round 31, not John-decided, John may override): Feed and My Trips show example requests built from the sample schedule so they look the way they will (they go away once flights are live). Feed lists "Requests on your airline's flights" (WN for now, see Q-067): flight and route, when it leaves and how long ago it was asked, never who asked, each with an Answer button. Answer opens Report Load (the v9.1 report screen): big Open seats and Nonrevs listed numbers with − and + (hold to go faster, tap to type), a live line with the tier and the seats left after the standby list, the sharing notice, and Submit Report (off, with "Set the numbers from the board" in place of the tier, until you change a number, so a stray tap can't report a false Full; a Done bar closes the number pad). Answered asks move to "You answered" with the tier word and both numbers in tier color; answers stay on that screen only. Open seats are capped at 200 until there's aircraft capacity data. My Trips gets "Your requests" above saved routes (Answered with the numbers, or Waiting; "1 of 5 requests open"). At large text sizes the Answer button or the badge moves under the flight. Profile rows open Settings scrolled to their section (backlog 56).
  - Provisional (design round 32, not John-decided, John may override): the flight sheet (tap a leg in a picked route) ends with a Seats card. The card sits right under the Departs and Arrives cards. Report Load (primary) opens the Report Load page inside the same sheet (VoiceOver starts on its title and comes back to the card); it's off outside the report window and says why ("Reports open 7 days before departure." or "Reports closed 2 hours after this flight left."). After a report the card says "You reported Good · 18 open · 3 listed · 2m ago" ("You reported" in amber, the tier word in its tier color) and the button reads Report Again. Ask for Load (secondary; "Ask other employees who fly this airline. They won't see who asked.") adds the flight to My Trips' "Your requests"; then it reads Asked, at full strength with a check ("The answer shows in My Trips"). It's off with a reason when you already have 5 requests waiting or the flight has left. One ask per flight. Answering an ask in Feed counts as your report on that flight. Until the requests backend exists, asks and reports last for the session only and asks stay Waiting.
  - Provisional (design round 33, not John-decided, John may override): the at-airport shortcut. With location on and a fix under 20 minutes old within 4 km of an airport, Search shows "At DAL? Report a load" under the search buttons (searching stays the main job), with "4 departures in the next 5 hours. Pick yours from the board." (counting only flights still to leave) and a secondary Report button (no button when the board is empty). It shows in Get Home mode too, unlike the prototype. Report opens "Departures from DAL": flights that left up to 30 minutes ago through the next 5 hours, your airline first, then by time; each row shows the time, flight and destination ("Left · …" once it has gone), and after you report, "You reported …". Tapping a row opens Report Load in the same sheet; coming back keeps your place on the list and VoiceOver returns to its title. Until the schedule feed is live, the board lists sample departures and the card shows only with sample flights.
  - Provisional (design round 34, not John-decided, John may override): in My Trips each request row opens its flight sheet (status plus the Seats card). While an ask waits, the Seats card has Cancel Request (a quiet text button) under Asked, which frees one of the 5 (no confirm: you can ask again). The note above Asked says "The answer shows in My Trips." in Search and "Waiting for an answer." when opened from My Trips. Later, with real notifications, cancel and ask again may need a cooldown so other employees aren't pinged twice. Once answered, "Answered: Good · 18 open · 3 listed · 9m ago" (tier word in tier color) takes the place of the ask button, in Search too.
  - Provisional (design round 35, not John-decided, John may override): Settings has a Notifications section with two switches, "Answers to your requests" (as soon as someone replies) and "Requests on your airline’s flights" (at most 5 a day), worded like the Feed and My Trips headings. Both start off, like Use my location, so that once push exists, turning one on can ask iPhone for permission from your tap. Profile shows a Notifications row (On, Answers only, Airline requests only, Off) that opens Settings at that section; Profile rows now follow the Settings section order. Nothing is sent yet: the switches are saved on the phone. Switch off tracks use the darker faint color so on and off read apart.
  - Provisional (design round 36, not John-decided, John may override): one word per thing across the app. "Request" is the noun (Feed's "Requests on your airline’s flights", My Trips, Settings, the 5-request cap); "ask" stays the verb ("Ask for Load", "asked 5m ago"). "Main home" replaces "home airport" in the app's own words, and Settings' button is Add Home. The board is "the departure board" the first time each screen names it. "Departed" is the status word on the departures board like elsewhere. The tier line says "seats after the standby list". Status and weather gaps say what's missing ("No status for this flight yet.", "No weather forecast for this airport.") instead of "not connected yet". The Settings and Profile switch now reads "Use your location", like the launch card. Unchanged because John decided them: "No Flights Found on Selected Date", "Show Them", the Leave-by card (Q-068).
  - Provisional (design round 37, not John-decided, John may override): big text and VoiceOver pass on the request screens. Titles stop growing at 1.6× so words never break mid-word, and from 1.8× a sheet's Done or Cancel sits on its own line above the title. The departures board stacks time over flight at big text. Profile and other list rows put the value under the label from 1.3×. Settings switches toggle from the whole row and read as one switch. Report Load fields read once each, the number box hint gives the range, and Submit says why it's off. After Cancel Request, VoiceOver moves to the note above Ask for Load. Announcements wait a moment so VoiceOver doesn't drop them. Buttons get vertical padding for two-line labels.
  - Provisional (design round 38, not John-decided, John may override): the app follows iOS Bold Text. With it on, every style steps up a weight (Manrope regular to semibold, medium and semibold to bold; Big Shoulders bold to extra bold). Map labels and leg-time pills step up too. It is read before the first screen draws; if it changes while the app is open, the tab bar, result rows and map follow at once and other screens as they redraw. Cancel stays a step lighter than Done.
  - Provisional (design round 39, not John-decided, John may override): first-run fixes. Find Routes tells VoiceOver why it's off (no From, no To, same airport), and the same-airport case shows a line under From/To. Swap is off (dimmed, with a hint) while either side is empty, so it can't wipe To. After Allow, the empty From card says "Finding nearest airport…"; if location is off it says so. With no main home, Search shows a light blue row with a house, "Set your main home to use Get Home ›", which opens Settings at Homes. My Trips says "tap the bookmark" (the save control) and that answers to Ask for Load show there.
  - Provisional (design round 40, not John-decided, John may override): with no main home, Profile's Main home row shows "Set Up" in blue instead of "Not set", so it reads as something to do.
  - Provisional (design round 41, not John-decided, John may override): live-status gaps say what happened. In the flight sheet, the "Updated" line, a failed refresh and the refresh button sit right under the status, above Seats; a stale update shows a clock and darker text. Refreshing before the 2-minute wait says "Just updated" only when the last answer is fresh, and "Try again in a couple of minutes." after a failure or with an old answer. Couldn’t-load says "Couldn’t get flight status. Try again in a moment."; refresh-failed says "Couldn’t refresh just now; showing the last status." In the delays and weather sheet, airports with a badge come first (worst first, not route order); an airport with no badge says what was checked: "No known disruption" (FAA and forecast checked), "No FAA delays" (no forecast yet for that time), "No weather forecast" (nothing checked) or "No data yet" (nothing came back). An empty route says "No delay or weather data for this route yet." without the sources line.
  - Provisional (design round 42, not John-decided, John may override): when live status says a picked route's first flight has left (the same test that grays the row, Q-050: never from the schedule), the Leave By card says "Departed" and "This flight has left DAL. Pick a later route." on a gray card with no location button, instead of "Leave now". With no live status it keeps "Leave now". A delayed flight keeps the scheduled count with a delay line (Q-070, decided above).
  - Provisional (design round 43, not John-decided, John may override): the Radar button is solid blue only while rain is on the globe; turned on but still loading or unavailable, it is light blue with a blue icon. VoiceOver reads the radar age as the button's value ("Radar, on, Radar 4 min ago").
  - Provisional (design round 44, not John-decided, John may override): when the delays and weather sheet reorders airports worst first, a small "Worst first" line sits above them, so the list doesn't look like it disagrees with the route under the title.
  - Provisional (design round 46, not John-decided, John may override): in a picked route the bookmark is a full 44pt target. Settings and Filters steppers put the label on its own line from 1.3× text, with the controls still at the right. Max stops reads "Nonstop · 1 stop · 2 stops · 3 stops", two by two from 1.3× text. The flight sheet footer drops "You can refresh every 2 minutes" (the tap says it when it matters).
  - Provisional (design round 48, from John's 2026-10-30 feedback, details not John-decided): a delayed time leads with the new time and puts the original after it, small and struck through, in result rows and the flight sheet's departure and arrival cards ("9:25 AM ~~9:00 AM~~"; "2:40 PM Estimated · ~~2:15 PM~~"). The Leave By card's small lines use the full card width under the title row, and its subs are shorter ("~25 min drive · at DAL by 1:15 PM", "75 min early to list and clear security"); small captions and card titles across the app avoid leaving one word alone on a last line. Tapping the Leave By card opens driving directions to the departure airport (John asked 2026-10-30; he left the details open): Apple Maps by default, Google Maps if picked in Settings under Leave-by ("Directions open in"), falling back to the Google Maps web page when the app isn't installed or nothing else opens; Android always uses Google Maps. The card shows a directions icon and a chevron (when no location button sits in its row); VoiceOver reads the title as a button with the hint "Opens directions in Apple Maps", and Use Location stays its own stop. No directions once you're at the airport or the flight has left.
  - Provisional (design round 49, not John-decided, John may override): Profile shows a "Directions open in" row (Apple Maps or Google Maps, iPhone only) that opens Settings at Leave-by. VoiceOver reads a flight sheet time the way the card shows it, the time that matters now first ("Estimated 2:40 PM, scheduled 2:15 PM"). A new time and the original it replaced always stay on one line together.
  - Provisional (design round 50, not John-decided, John may override): your requests in My Trips show the flight's live status like a result row. A waiting request on a delayed flight leads with the new time and puts the scheduled one after it, small and struck ("Departs 2:40 PM ~~2:15 PM~~ · asked 20m ago"), with the Delayed, Departed or Canceled tag under it. A canceled flight strikes the time ("Scheduled ~~2:15 PM~~"); one that left says "Scheduled 2:15 PM" instead of "Departs". An answered request on a delayed flight keeps its answer line and the tag carries the new time ("Delayed 25m · now 2:40 PM"). VoiceOver reads the times once, then the tag.
  - Provisional (design round 51, not John-decided, John may override): Feed requests show the flight's live status the same way as My Trips (new time first, tag under it).
  - Provisional (design round 52, not John-decided, John may override): buttons, body text, banners, list labels and empty states also avoid leaving one word alone on a line. The Settings title is capped at big text like other screen titles. My Trips with no saved routes says where the bookmark is ("Open a route in Search, then tap the bookmark beside its name") and has a Find Routes button; the empty My Trips says "Two things show up here." above its two points. Q-073 asks whether "No Flights Found on Selected Date" should get a Try Tomorrow button.
  - Provisional (design round 53, not John-decided, John may override): an empty From or To says what to do in blue ("Choose airport"), so a dimmed Find Routes explains itself without an extra line. With location denied, From reads "Location is off." in gray and "Choose airport" in blue.
  - Provisional (design round 54, not John-decided, John may override): while routes load, four gray row-shaped placeholders sit under "Finding routes…" (static, nothing moves). Couldn't-load says the search is still set: "Your search is still set. Try again in a moment." (live data: "Check your connection, then try again. Your search is still set.").
  - Design round 56 (John, 2026-10-30: the picked route should be all in view, and stops were hard to read at a glance). A picked route's panel opens exactly as tall as its content (title bar, Leave By and route card), never past full height, so nothing sits under the fold; the globe gets the rest. Provisional layout (not John-decided, John may override): the route card lists legs on a thin timeline down the left, one dot per leg in that leg's seat color. Each leg is one tap target: departure time (new time first when delayed), airports and flight on the first line, its seats in small plain text under them (the dot carries the tier color), with no second chip. A route that needs nearly the full height opens full; paging only grows the panel while a route is open. Each connection is a short line between legs ("Connect at PHX · 2h 40m"). The route's overall seats stay in the one chip at the top. Seat label wording is open in Q-074.
  - Design round 58 (John, 2026-10-30): when a time moved, the old time sits small and struck on the LEFT of the new time, everywhere (result row times, route card legs, flight sheet, requests); supersedes "the old one small and struck after it". ~~In the list, any live tag (delayed, canceled, departed, connection at risk) stacks the flights one per line with each tag beside its own leg, so a canceled leg is labeled on that leg.~~ (changed 2026-10-31 by John: "Slim the list rows": the flights stay on one line with one tag that names the flight, e.g. "PHX → LAX delayed 40m", picked by the same order as the route card's headline.) A hard pull down on the route view or the results list while at its top (about 50pt past the top, or a fast flick down) steps the panel down a size, so you don't have to grab the handle. VoiceOver still says the new time first.
  - Design round 59 (John, 2026-10-30: "You don’t need to show the time crossed out twice"): in the route card the struck original time shows only in the top time line. A delayed leg line shows just its new time with its Delayed tag; a canceled or diverted leg line shows no time, only its tag. Provisional (not John-decided): "Long shot" never splits across lines.
- 2026-11-01 Fix: Find Routes crashed in Expo Go after round 85. The pulse ran on Reanimated (Skia useClock + useDerivedValue), the app's first Reanimated use. It now records a small Skia Picture on the JS thread about 30 times a second, same calls as the route layer, with a guard so a drawing error drops the pulse instead of the app. A test fails if app code imports Reanimated again.
- 2026-11-01 Round 86: with a route picked, the globe shows only that route. The other options' faint ghost lines are gone (John: the preview should be just that route). Before a pick, every option still shows in gray.
- 2026-11-01 Round 87: the map legend is a slim one-row chip and a picked route is framed above it, so it never covers a line. Leave By is one slim row ("Leave by 9:20 AM · ~50 min drive", tap for directions); the full line is still read by VoiceOver, and delay and location notes only add a line when they apply. The route sheet is shorter, so the map gets the room (John).
- 2026-11-01 Round 88: the results drawer slides instead of resizing. It stays laid out at full height and moves on the native driver, so a drag or a settle never re-lays out the content each frame. A hard flick carries on at its release speed to the next size in its direction, with no bounce past it, no snap back and no second animation when the screen hears the new size. The hidden part is padded off once it settles, so lists still scroll to their end (John: hard drags felt clunky).
- 2026-11-01 Round 89: drawer, second pass (John: still clunky on a hard drag). The finger now drives the slide on the native side (gesture handler's Animated event), so a drag never waits on the JS thread, which is busy with the globe. The screen hears the new size only after the panel stops, so the map's re-frame and the screen's re-render no longer run under the moving panel. No relayout at drag start. Core Animated and gesture handler only, both in Expo Go.
- 2026-11-01 Round 90: the legend is a small card that hugs its lines, pinned top-left of the map, far from the drawer at every height, with the route framed below it. Collapsed with a route open, the drawer shows exactly its handle and title bar, so nothing is sliced mid-line. The route pager has room between the arrows and the count. A picked route's title uses its own airports (DFW → LAX on a DAL/DFW search) (John: legend too wide and touching the drawer; collapsed drawer looked squished).
- 2026-11-01 Round 91: once a route is picked, the drawer is locked at the route's size: no handle, no drag, no tap or pull to resize. Back to Routes unlocks it. Before a pick the drawer drags as in round 89 (John: I shouldn't be able to pull it up or down once I select a flight).
- 2026-11-01 Round 92: a diverted flight is no longer drawn like a cancellation. Its times aren't struck. Its tag, the card's top pill and the flight sheet say where it landed ("Diverted to COS") when the live data gives an airport other than the planned one, and just "Diverted" otherwise. The leg box adds "Continuing to DEN · new arrival time pending". The connection after it is flagged at risk, the route still counts as flyable (only a cancellation ends it), and the map marks the diversion airport on the picked route. Not yet checked against a real AeroDataBox diversion whether its arrival airport is the diversion airport (John: a diversion still ends up at the destination).
- 2026-11-01 Round 93: search panel cleanup (John). Get Home hides once To is already a home airport (its own code or another in the home area), so Find Routes is the one filled button; Get Home still shows while To is empty or somewhere else. Swap works with one side empty and moves it across (LAX in From, To blank → To is LAX, From blank); it's off only when both are empty. The drawer's middle stop opens down to the bottom of Filters and Find Routes, measured from the panel, so nothing sits under the fold; it's still about half when the content is shorter, and never full height.
- 2026-11-01 Round 94: the globe holds still on a swap. It rests on From, but swapping the same two airports keeps the spot it had (also with one side empty), and the drawer's measured stop only grows within one layout, so Get Home coming and going no longer moves the drawer and re-zooms the globe. State lines are drawn on every frame, moving or not, so they no longer blink off and back on when the globe turns to a new From (John: the globe re-zoomed on a swap and the state lines re-rendered).
- 2026-11-01 Round 95: first home animations (John picked all six). Buttons and pill buttons shrink a hair (to 97%) and dim while pressed, on the native driver, and spring back on release; Reduce Motion keeps only the dim. The swap button turns half a turn on each swap while the two codes slide in from the other card's side (280ms). The picked date's highlight slides to the new chip instead of jumping, and each chip's words turn white as it passes; at large text sizes, with the chips two to a row, each chip keeps its own fill. Reduce Motion: no slide, no turn.
- 2026-11-01 Round 96: the other three home animations. A soft amber ring grows off the home pin and fades every 3.6 seconds (hidden while the globe moves, with a route open, off the Search tab, and with Reduce Motion). Once From and To are both set, a faint accent arc draws itself from From to To in under a second and stays until a search draws real routes; with Reduce Motion it just appears. Left alone on the search page, the globe sways slowly east and west of where it sits (toned down in round 97), and stops where it is the moment it's touched, a target changes or a route opens, so it never jumps. All JS timers and Skia, nothing new to install.
- 2026-11-01 Round 97: the idle globe sway is toned down to a barely-there drift: 3 degrees each way (was 9) over a 90-second cycle (was 48), starting after 8 seconds alone (was 5) and easing in over 8. It still stops the moment the globe is touched and stays off with Reduce Motion (John: tone down the sway).
- 2026-11-02 Round 98: the home globe now opens 30% closer than the whole-globe fit (HOME_ZOOM 1.3) so your region fills the view; route fits are unchanged. Typical seat loads drop the month suffix and read "~20 open seats estimated" (was "Usually ~20 open · Nov avg") on the result row, the leg list and the flight sheet (John).
- 2026-11-02 Round 99: the home globe opens closer still, HOME_ZOOM 1.8 (was 1.3 in round 98), so the region around you fills the top of the screen. Route fits and pinch limits are unchanged (John: zoom in more).
- 2026-11-02 Round 100: in the route card leg list, every leg's status pill (Diverted, Delayed 25m and so on) widens to the widest one, text centered, so the flight number chips that follow start at the same spot on every leg. A leg with no status pill keeps its chip at the left; a lone pill keeps its own size (John: the flight number pills should align).
- 2026-11-02 Round 101: after a search, the results list is the whole screen until a route is picked: the panel fills everything under the wordmark with a square top, no handle and no drag, so there's no sliver of globe or grey preview lines above it. Picking a route brings the globe back at the route size as before; closing it goes back to the full-screen list (John).
- 2026-11-02 Round 102: a time that moved is tinted by how far: 5+ min early green; within 5 min either way plain; 5 to 15 min late yellow; 15 to 45 orange; 45+ red. Soft text tints (new tokens timeEarly, timeSlight, timeLate, timeVeryLate, each 4.5:1 on every surface in light and dark) on the route card's new departure and arrival, each leg's new time, and the flight sheet's estimated or actual time. The struck old time stays muted, departed routes stay muted, and the Delayed tag and delay words still say it (John).
- 2026-11-02 Round 103: much more sample data. The sample schedule grows from 35 to 112 daily flights: every other airport in the table now has nonstops from DFW (AA, some DL and UA) and DAL (WN, some DL and AS), flights back to Dallas, and onward hops (CLT, ATL, DEN, PHX, ORD, MIA) for one-stop routes. Sample statuses now use each flight's real arrival time and cover landing early (8 to 18 min) and delays of 10, 25, 50 and 80 min, so every time tint shows, plus departed, canceled, arrived and diverted. No new airports, so the live schedule pull is unchanged (John: so many routes out of Dallas show no data).
- 2026-11-02 Round 104: each leg's dot on the route card is now a 40 pt circle holding that flight's open/listed seats ("10/3", "5/20"; "~20" for a typical load, a dash with no data), tinted fill and ring in the leg's seat color with the tier's text color. The Likely delays / Caution pill is gone from rows and the route card (the details stay in the VoiceOver label and action). The slim row's seat chip now always stays beside the times instead of wrapping under them at normal text size. Also fixed a code comment that had leaked into the slim row's layout as text (John).
- 2026-11-02 Round 105: every nonstop still to leave always makes the 10 routes shown. When the departure-order cut leaves one out, it takes the place of a connecting route (most stops first, then the latest). The list never grows past 10, and a nonstop that already left follows the usual rule. BNA to LAX shows its nonstop again (John: always show nonstops).
- 2026-11-02 Round 106: a row whose time moved no longer wraps. The schedule sits small and struck on its own line above the times, and the big line keeps only the times now (tinted by how far they moved), on one line that shrinks to fit at normal text sizes. The route card drops its big status banner ("DFW → MIA canceled"); each leg's own pill already says it, so the seat chip leads the card again and the bottom line reads "Seats est. …" (John).
- 2026-11-02 Round 107: the home drawer's middle stop now opens down to the bottom of the whole search panel (measured from its content size), so the "At DAL? Report a load" card and the set-home hint show without a scroll. The card is slimmer (bold body title, 32 pt icon, 8 pt vertical padding). The home globe zooms in from 1.8 to 2.4 around your location (John).
- 2026-11-02 Round 108: each leg box on the route card shows both times, "6:55 AM – 9:40 AM  DFW → CLT". A moved time shows the new one, tinted by how far it moved (each leg now carries its own new arrival from live data). A canceled leg keeps its scheduled times, struck through and grey. The top times are no longer struck when a leg is canceled; they go grey instead (the leg pill says Canceled). The leg line shrinks a little to fit rather than wrap (John).
- 2026-11-02 Round 109: the idle globe sway is gone; the globe stays still until you move it (the home pin ripple and the From/To arc stay). "At DAL? Report a load" left the drawer and drops down from the top into the map as a banner (spring, after a short wait; just there with Reduce Motion), on the search page only; the globe keeps its center clear of it. Search results open pinned to the Now line, re-pinning as rows measure in until you scroll; routes that left are a scroll up. The globe no longer draws every result as grey lines, only the picked route, so the overview can't flash while the panel moves (John).
- 2026-11-02 Round 110: the "At DAL? Report a load" banner dismisses with a swipe up or its X, and stays gone for that airport until the app restarts. Connection times on the route card and the slim row use the live times, so a late inbound or onward flight moves them; a connection the live times break reads "Misses the connection at DEN" with a Missed tag (At risk when only too short), and the trip length follows the live times too. Every leg box has one layout: times, then the airports in one column across the boxes, then the status pill and flight chip. The purple diamonds (Caution airport badges from sample delay data, with no legend) are gone from the map, and the map's leg labels read "2h 5m" like the cards. The pill reads "You're at DAL (Dallas Love Field)" and "Flight departs at 11:40 AM". Coming back from a route lands on the Now line at the top. Audit: every duration uses one format ("2h 5m", "45m"), including delays on the flight sheet ("50m late"), airport delays, drive time, the airport buffer and nearby-airport notes; VoiceOver reads these as hours and minutes (John).
- 2026-11-02 Round 111: the Now line shows only on today's results (by the origin's date). The banner's X is a small round button on the card's top-right corner, like a notification's; swipe up still works. A nonstop's leg box drops the times (the header has them) and shows the airports and flight. A diverted leg's arrival slot reads "TBD", muted, and its note says "Continuing to BNA"; with a diversion on the route the header arrival reads TBD and the trip length is left off. The leave-by line puts its detail on its own line, with no dot, when the one row would wrap ("You're at DAL (Dallas Love Field)" over "Flight departs at 2:25 PM"). Leg boxes list the flight chip first, in one column as wide as the widest, with the status pill after it, so the pills line up top to bottom. A route with a canceled leg shows a grey "Not flyable" chip in place of its chance word, a grey edge, and a grey dot for the canceled leg. The leg 2 airports in John's DFW to BNA screenshot were in the shared airports column from round 110; with TBD in the arrival slot the gap is smaller (John).
- 2026-11-02 Round 112: My Trips drops both Find Routes buttons (the Search tab is a tap away). "Your requests" lists only flights still to leave, soonest first; each drops off at its departure time (the tab ticks then) or as soon as live data says it departed or arrived, and a request for a flight that left no longer counts toward the 5 waiting. The To card already has the same area pill as From, but only Dallas has two airports in the app's list, so it shows only for DAL or DFW; other metros need their sister airports added (more schedule data), which is John's call (John).
- 2026-11-02 Round 113 (John: "doesn't feel premium... text and font choice... missing animations... bare bone"; benchmark Flighty, nothing over the top): body and display text move to Inter (400 to 800) on a tighter scale with slight negative tracking on big text; the wordmark keeps Big Shoulders. Times use tabular figures so they line up. Result rows, saved route cards and the airport card get one soft, wide shadow (elevation.card) and hairline borders; banners float on elevation.raised. Results fade and rise in, 40 ms apart, capped at 8 steps, only when a search first shows (StaggerIn); Reduce Motion skips it. Cards and leg boxes shrink a hair under the finger and spring back with a few percent of overshoot (no wobble). Primary buttons give a light impact; Save, Submit Report and Ask for Load give the iOS success tap; picks keep the selection tick.
- 2026-11-02 Round 114 (John picked look C, Boarding pass, from three mockups after saying round 113 read as bigger, bolder stock text; Inter was loading, it is just near-identical to the iPhone's own font): titles in Instrument Serif (screens, sheets, the route bars "DFW → LGA"), body in DM Sans back at round 112's sizes (body 14, heading 16), times and flight numbers in DM Mono, big airport codes in DM Sans Bold; Big Shoulders stays only on the wordmark; Inter removed. The route view's card is a boarding pass: a navy ink stub (seat chip, Save, times, stops) over a torn edge with half-circle bites, then the flights on white. Things on the stub take the inkColors palette through InkContext (all text pairs pass 4.5:1). The result list and route view sit on the page color so white cards and the tear read. Kept from 113: springy press, haptics, staggered results, soft shadows.
- 2026-11-02 Round 115 (John: "Yes, do My Trips"): saved routes in My Trips are boarding passes like the route card: a navy stub with the path in the serif and the day and times, the trash button in the stub's top-right corner, a torn edge, then the flight numbers in DM Mono with the chevron. The whole pass presses gently; the trash stays its own button for VoiceOver. TicketTear now lives in its own file and is shared by both.
- 2026-11-03 Round 116 (John: the route map looked "cluttered and squished"; "Change Airlines should say Change Airlines to AA"): the route panel is capped at 60% of the screen body and the card scrolls past that, so the map keeps room for the whole route (it no longer opens full for a long route). The line key is a small "Key" chip with one swatch per line that opens on tap and folds on a second tap; only the chip's height is reserved when framing. Airport labels keep inside the map's visible top and bottom (no more DAL/DFW cut off by the drawer), also try above and below the mark, and when nothing is free take the spot that covers the fewest things. A change of airline names the onward airline ("change airlines to UA"). Sample flight statuses now follow the clock: nothing ahead of now reads Departed, Arrived or Diverted, and a flight still in the air reads Departed, never Arrived (an evening leg showed Arrived while the route was still ahead).
- 2026-11-03 Round 117 (John: "Can we redo the design to the Departure Board style instead?", look A on the OutBound looks page): the app switches from the Boarding pass look to the Departure board. It stays dark whatever the phone is set to (app.json and Appearance), with amber as the accent (#f5b544, dark text on it) for buttons, selection, links and the arrows in route titles. Type: Big Shoulders Display 800 for titles, route names and airport codes (upper case for titles), JetBrains Mono for times, flight numbers and seat chips (bold, upper case on chips), Manrope for reading; Instrument Serif, DM Sans and DM Mono are gone. Corners are tighter (6 / 10 / 22) and cards are flat, with no shadow. The route card and saved routes keep their header, dashed rule and body, now as a board panel instead of a navy ticket stub with a torn edge. Flight chips are grey with white mono numbers so amber stays for what you can act on. Every earlier layout decision and round 116's map fixes stay.
- 2026-11-03 Round 118 (John: "Add a light version"): the Departure board follows the phone's light or dark setting again. Light is a cool grey board (#eef1f5) with white panels, near-black type and a deeper amber (#8f5200, white text on it) so amber still reads as text on white; the raised panel on the route card and My Trips is white. Dark stays as round 117 had it.
- 2026-11-03 Round 119 (John picked the mini route line for markets on result cards): the slim row's "DFW → ORD → LAX" text is now a mini route line. The origin and destination are big at the ends in the board face, a line runs between them with a solid dot at each end and a hollow dot per connection, and each connecting airport sits small in mono above its dot. It's drawn only; the row's VoiceOver label still says the route. Dimmed rows grey the ends. Works in light and dark.
- 2026-11-03 Round 120 (John: "I think we need to go with the clean look instead", look B on the OutBound looks page): the app switches from the Departure board to Clean, closest to Flighty. Geist for titles and reading (titles bold and tightly tracked, sentence case), Geist Mono for times and flight numbers; Big Shoulders stays only for the wordmark; JetBrains Mono and Manrope are gone. Light: pale page #f4f6f9, white floating cards with a soft shadow, quiet #f3f6fa boxes inside, navy accent #1d3d84. Dark: the Ice Mix dark palette with the light blue accent #9bb8ef. Follows the phone's light/dark setting. Corners 12 / 18 / 26. The picked row stays white with an accent outline. Seat chances read as a colored dot and word, no fill. Flight chips are back to accent on a soft tint. The route card has no rule between header and flights; saved routes have a hairline. Route title arrows are soft grey. The mini route line stays, restyled: bold ends, accent rings at the start and each stop, a filled dot at the end. Map fixes and earlier layout decisions stay.
- 2026-11-03 Round 121 (John: "Can this be design like subtle boarding pass ticket"): the Clean cards get a light boarding pass touch, not the navy ticket from look C. A fine dashed perforation with a small half-circle notch at each card edge (filled with the page color, outlined to match the card border) sits between the times and the mini route line on result rows, between the header and the flights on the route card, and between the path and the flights on My Trips cards. New TicketTear replaces CardDivider. Mini route line, mono times, Likely dots and dark mode unchanged.
- 2026-11-03 Round 122 (John, on the picked route: "The market is warping down ... It feels squished and forced", "requires me to scroll down just a bit", and "The connection dot ... a little more to the left than centered"): the route view bar is one slim row: a bare back chevron, the market on one line that shrinks before it would wrap, and a compact pager. The route card header is two rows: the times with Save top right, then one small line with the chance dot, stops and trip length. Tighter padding around the Leave By card, the card header, the tear and the leg boxes, and the route panel may take up to 64% of the screen (was 60%) so a one-stop route fits without scrolling. The mini route line places stops by percent between the end dots (1 stop dead centre, 2 at thirds), each code centred over its dot, and the dots now sit centred on the end codes.
- 2026-11-03 Round 123 (John: "Stop using bullet points to separate text", meaning the · dots in the app): no middle dots between visible text anywhere. New MetaLine lays out "1 stop · 11h 5m"-style lines as separate items with a gap that wrap between items (route card subline, slim row stops and trip length, sheet subtitles, My Trips day and times). Text that must stay one run (mixed colors inline, the Leave By line, request and departure rows, flight status gate and seat lines) gets a wide em space via spaced(). Prose takes a comma ("change airlines to UA", "now 2:40 PM", "may be out of date") or parentheses (Logbook highlights, radar source). The results date and count stack on two lines; the Now line is "Now" and the time as two words; area airports read "DAL, DFW"; Get Home reads "Get Home to Dallas". Data strings keep the dot as an internal separator for VoiceOver, which reads it as a pause.
- 2026-11-03 Round 124 (John: "Needs dividers", "Can you say No Estimate", "Can the number of stops be listed on top of the time? Even when it says Nonstop?", and "I also don’t need you to label when a user reported or estimated x time ago at this time"): items that used to have dots now have a thin vertical divider in the soft line color (MetaLine draws a 1pt bar; one-run text uses Divided, a faint thin bar between en spaces), plus a faint accent bar between Now and the time. "No data yet" reads "No Estimate" everywhere (seat lines and the delay sheet). The stop count sits on top of the trip length, right-aligned, on result cards and the route card (Nonstop too; a short layover rides on the stops line after a divider); the route card header is times over the chance word on the left, stops over trip length on the right, Save top right. Seat source and age labels ("Seats reported just now", "Est. 45m ago", "Reported 5m ago", the age on your own report) are hidden behind SHOW_SEAT_AGE = false in format.ts; the data stays and VoiceOver still hears it.
- 2026-11-03 Round 124, cont. (John: "Not flyable sounds weird for a label when a flight is canceled", then "Use Unavailable"): a route with a canceled leg shows "Unavailable" in place of its chance word.
- 2026-11-03 Round 125 (John: "A cute animation of tearing a ticket of a flight you save onto your trips"): tapping Save on a route pops a little paper ticket out under Save (route and times on the pass, an accent stub past a dashed perforation with notches). The stub tears off and drops away with a light haptic tick, and the pass arcs down toward My Trips in the tab bar, shrinking and fading. About 0.8s in all, on the native driver, drawn on a layer that never takes a touch (TearAwayHost on the Search screen). Taking a route back out flies nothing. With Reduce Motion on there is no flight; Save's own icon change, tap and VoiceOver line still say it.
- 2026-11-03 Round 126 (John: "Can you have it actually tear off the perforated line on the flight card. Is what I meant"): replaces round 125's separate pop-out ticket. Tapping Save on the route card tears the card's own header (times, chance word, stops, Save) off along its dashed perforation: a small wobble, the rip with a light haptic and a ragged paper edge, then the piece arcs down into My Trips and shrinks away while the dashed line stays on the card; the real header then settles back with a small bounce so the card is whole again. About 0.9s in all on the native driver, on a layer that never takes touches; the flying copy is hidden from VoiceOver and shows the bookmark filled. Nothing moves with Reduce Motion or when taking a route back out.
- 2026-11-03 Round 126, cont. (John: "The key also looks like it needs work. I'm not sure what it means as a new user"): the folded chip reads "Map key". Opened, it has a title and three plain sections: "Line color is your chance of a seat" (each chance word on this route with a short meaning, e.g. "Likely  good odds of a seat"), "Line style" ("Solid line: seats someone reported", "Dashed line: our estimate"), and "Seat circles on the route card" (a "10/4" circle: "10 open seats, 4 people listed"). The route card also says under its legs "In each circle: open seats / people listed" when a circle shows two numbers.
- 2026-11-03 Round 127 (John: "Can you have it pulling back the card and tearing it horizontally?"): the save tear now reads like tearing a stub by hand. The route card's header first bends back toward you at the dashed perforation (a 3D peel hinged at its bottom edge, about 26 degrees), then the rip runs along the line from left to right: the free left end lifts while the right stays attached, the ragged edge appears hole by hole, and three light haptic ticks fire along the way. Once fully torn it arcs into My Trips as before and the header settles back on the card. About 1.1s in all on the native driver; nothing moves with Reduce Motion.
- 2026-11-03 Round 128 (John: "Bend it more", "Like bend it back and tear"): the save tear folds the header hard back along the perforation (72 degrees, hinged at the dashed line, with a soft shade as the paper turns from the light and a tick as it creases), holds the crease for a beat, then rips left to right along the fold with light ticks while it's still bent back. In flight it opens part way (to about 28 degrees) so it still reads as a ticket on its way into My Trips; the header settles back on the card. About 1.3s in all; nothing moves with Reduce Motion.
- 2026-11-03 Round 129 (John: "No it folds in like a 2D effect. The idea was like a 3D effect and bending back the whole card as if it's in your hand and you're tearing it down the line"): the whole route card now takes part. On Save it's picked up (a small lift, 1.03 scale and a slight 3D tilt, shadow deeper), then both halves bend back away from you around the perforation like paper held in two hands: the header back 40 degrees from its bottom edge, the rest of the card back 34 degrees from its top edge, each under a close perspective so the far edges visibly narrow (about 12% and 22%) instead of squashing flat, and each face darkens toward the crease. It holds creased for a beat with a tick, then rips down the crease from left to right (ragged edge hole by hole, light ticks), the top flies into My Trips while the rest of the card lies back flat, and the header settles back on. Drawn as a copy on the flying layer while the real card hides, so the layout never moves. About 1.4s; nothing moves with Reduce Motion.
- 2026-11-03 Round 129, cont. (John: "Change to Arrive at DFW by 2:40 PM on the leave now button instead of just saying At DFW"): beside Leave now, the slim Leave By row reads "Arrive at {airport} by {time}".

## Round 130: the torn top curls back like an exponential curve (John)

John: "I don't want flat tearout. I quite literally want it to bend back and tear like an exponential graph." The round 129 fold bent at one hinge, so it still read flat. The stub is now 14 sibling slices placed by shared-space math (slicePoses): each slice's bend grows exponentially (curlTurn, growth 3.2, 140 degrees in all), so the paper stays nearly flat at the perforation and rolls harder toward the free edge. The curl deepens on an exponential ease, the rip runs while it's curled, and the stub flies to My Trips still curled. Past upright each slice shows the plain back of the paper with a shade, so the roll reads as paper. Slices are siblings, not nested, because RN flattens nested 3D. Checked with drawn frames from the app's own numbers and a side profile that reads as a curve, not a hinge.

## Round 131: pull the stub toward you and tear it off on a diagonal (John)

John: "Pulling back my direction and tearing it horizontally or at a diagonal is what I was expecting." Every earlier round bent the stub away, into the screen. Now the curl turns the other way (CURL_TOTAL_DEG -64, growth 2.4): the stub comes up out of the screen toward you, still flat at the perforation and curling harder toward its top, growing a little (PULL_SCALE 1.06) with a soft three-band shadow on the card under it. The card is held with its top tipped toward you (rotateX -6, rotateY -10). The rip then starts at the right notch and zips left: the stub is hinged at its bottom left, so its right end rises (to -6deg while zipping), and once free it swings up and out to the right (to -16deg, 26 right, 30 up) before flying into My Trips. The rest of the card tugs back a few points the other way. Teeth along the torn edge appear right to left. Checked with drawn frames from the app's own numbers and a side view showing the curl toward the viewer.

## Round 132: John's list of seven (map zoom, home label, card layout, Likely, tear, airline marks)

- Home map: HOME_ZOOM 2.4 -> 3.2 (John: "still zoomed out a little too far").
- Home pin: a little smaller (r 9 -> 7.5, label 12.5 -> 11.5pt) and labelled with where home is, not its codes: "Dallas, TX" in the US, city and country code elsewhere (placeLabel in engine/airports.ts; airports gained city, region, country). Unknown places keep the codes.
- Seat circle explainer under the legs removed (John doesn't need it; the Map key still explains the circles).
- Flight boxes (John: "just looks like a bunch of text on one row… pills or containers"): each leg is its two ends, the leave time over the from airport in a small pill on the left, the arrive time over the to airport on the right, and a line with a plane and the flight's length between. A nonstop shows only the airports (the header has its times). Options B (times and route as two pills) and C (route first, times under) were sketched; A built.
- Route bar title: two airport pills joined by a short line with a plane, instead of "DFW → SEA" text.
- The seat chance (Likely etc.) sits above the header times as a small outlined pill in its tier color, not under them.
- Airline marks instead of AA/DL/UA/WN: a small tail in each airline's colors with a plane, then the flight number. These are our own marks in the airlines' colors, not their logos (trademarks); real logos would need a source with clear terms. Unknown airlines keep the code. The name is spoken.
- The save tear is now real bent paper: a picture of the route card (Skia makeImageFromView) laid on an 18-column mesh (tearMesh.ts), bent in 3D, seen in perspective and lit per vertex, drawn on the JS thread each frame (no Reanimated). The card tips back and bows in your hands, the stub rolls up toward you on an exponential arc (150 degrees at the top edge, so its back shows), the rip runs from the right notch leftward with each torn stretch letting go of the line, then the stub swings up and right and flies to My Trips. If the picture can't be taken, the round 131 sliced tear runs instead. Checked with frames drawn from the mesh maths, not on a device.

## Round 133: real airline logos, and swipe the perforation to save (John)

- Real logos (John: "Yes, find real logos"). Sources checked: Logo.dev's terms allow showing logos inside an app to identify a brand (not to imply endorsement), with a visible "Logos provided by Logo.dev" link on the free plan (for a native app, on its website or store listing), and its publishable key is safe in client code. Airhex is airline-specific but has no stated free tier, needs a key and signed URLs from a server, and says commercial use depends on a paid licence. Kiwi or Google image URLs have no usage terms, so they're out. No source grants the airlines' trademark rights: Southwest's own terms say its marks need written consent, so a public release should check with the airlines or rely on identifying use. Built on Logo.dev: each airline row carries its domain; with EXPO_PUBLIC_LOGO_DEV_KEY set (GitHub secret LOGO_DEV_KEY, never in git) the mark is the real logo on a small white tile, with fallback=404 so a missing logo falls back to our tail mark. Settings shows the Logo.dev credit link when logos are on. Without the key nothing changes.
- Swipe to save (John: "can it be swipe left on the perforation to save the flight? It rips away and looks realistic"). A strip 16pt above and below the route card's perforation takes a clear leftward swipe (TearSwipe, PanResponder, no Reanimated). The finger drives the round 132 paper tear: the first 22% of the swipe picks the card up and pulls the stub toward you, the rest rips it right to left under the finger (dragMs). Let go at 60% or more, or flick left once the rip has started, and it tears free, flies to My Trips and saves; let go sooner and the paper lays back down with nothing saved. Haptic ticks fire as the paper goes taut and along the rip, wherever the tear is driven from. Save in the corner still works and is how VoiceOver saves; with Reduce Motion the swipe still saves, without the tear.
- Turning logos on (Nov 4): John added LOGO_DEV_KEY. The publish step only bakes it in when it's a publishable key (pk_), so a secret key can never ship in the app, and a new "Check the airline logos" step fetches each airline's logo with it after publishing and logs the HTTP status (never the key).

## Round 134: swipe fix, bigger logos, home label back, route bar centered with dots (John)

- Swipe to save didn't work on John's phone ("doesnt work as well. I tested it"). The strip used a JS PanResponder, and the route card's scroll view takes the touch natively as soon as a finger moves, so the strip never kept it. It's now a native pan (react-native-gesture-handler, already used by the panel's handle), starting only after 10pt to the left and failing after 14pt up or down so scrolling still works; it reaches 18pt either side of the perforation and sits above the flights so its lower half isn't covered. A cancelled touch never saves. Not yet checked on a device.
- Airline logos bigger (22pt in rows, 28pt on the route card, up from 16 and 20) and straight on the card with no white tile (John: "bigger with a transparent background"). On dark backgrounds (dark mode and the navy header) the logo is asked for with Logo.dev's theme=dark, which lightens a dark logo so it doesn't vanish. The publish job now keeps each logo's light and dark picture as a run artifact to check how they read.
- Home pin label back to the home's airport codes (John: "change the home labeling back to main home"), keeping the smaller round 132 pin.
- Route bar (John: the market "feels odd that it's aligned to the left", the pager "feels forced to have in the top right"): back on the left, the two airport pills truly centered, and under them a dot per route (the current one a longer accent pill; past 9 routes it reads "2 of 24"). Swipe the bar left for the next route or right for the one before, or tap a dot. The arrows are gone; VoiceOver flips by swiping up or down on the dots.
- Logo check removed from the publish job: Logo.dev's fair-use page asks that logos load in users' apps, not from scripts, so the job no longer fetches them. The one check it ran found all nine airlines' logos load. It still ships only a pk_ key.

## Round 135: the swipe tears on the dashes, with a dull-knife edge (John)

- The rip ran 7pt above the dashed line (John: "When I swipe left it's not cutting at the perforated line"). It was split at the bottom of the header, but the dashes are the middle of the 14pt notch strip under it. The route card now measures the dashed strip itself and the paper splits down its middle (perfLine), falling back to the header's bottom if that strip can't be measured.
- The torn edge is no longer a clean straight cut (John: "Make it look like if I had cut paper with a dull knife"). The mesh is finer across (48 columns, up from 18), and the edge wanders up to about 3pt either side of the dashes: a slow waver plus a small random jump at each column, like fibres giving way unevenly. Both pieces share that exact edge, so they'd fit back together, and it pinches to the dashes at each notch. Along each edge as it tears, a fuzzy pale rim with a faint grey shadow (so it shows on white and on dark paper) and short paper hairs sticking out of about half the columns. Not yet checked on a device.

## Round 136: leg pills, airline codes, Leave now car, a flat stub tear, route paging hints, one text color rule (John)

- Delayed pill (John: "Can the delayed pill be centered with the route line just above it"): a leg's status pill now sits in the middle between its two airports, right above the route line, and the flight's length moves under the line. The airport pills rise a little to stay level with the line. The flight chip has its row to itself.
- At risk (John: "on top of the connection time message and aligned center"): the pill now sits above the connection line, and both are centered in the column the flight boxes use.
- Airline code back (John: "Add the callsign next to the flight number again like DL, WN"): the chip reads "AA 1732" with the logo in front.
- Leave now (John: a car "so people know it's directions"): the chevron is a car in the accent color.
- The tear (John: "It still doesn't cut along the line when I swipe left. Also the bend back looks bad. Can it just be like a stub we're cutting back?"): the 3D pick-up, bow and curl are gone. The card stays exactly where it is on screen and only the stub moves: the rip starts at the right notch the moment the swipe starts and runs left with the finger, the torn stretch tipping up off the dashed line about the tear front, like tearing a stub back. Once it lets go at the left notch it carries on up and left, then flies to My Trips. Why it missed before: the card was tipped back and turned in 3D with perspective, so the paper's dashes moved off where the real dashes are on screen even though the split was on the line in the picture. Now nothing under the line moves at all, and the dashes are measured inside the card itself (measureLayout against the card) instead of from two separate screen measurements. Tests check every pose keeps the card under the dashes pixel for pixel and the split within the ragged edge's 4pt of the dashes. Not yet checked on a device.
- Paging routes (John: "Hard for a user to know they can swipe left or right"): small arrows either side of the route dots (faint at the ends), swiping the card itself flips routes too (a leftward swipe that starts on the perforation still tears, since that strip's swipe starts sooner), and the first time a route opens with others beside it the card slides a little left and springs back, once per phone. Peeking the next card's edge was left out: it fights the swipe to tear and squeezes the card.
- Text colors (John: "What's with the navy colors and we have black text on different pages"): the navy was the accent, used on the route bar's airport pills, the flight chips and the Now line, all things you read rather than press. The rule now, written on the color tokens: everything you read is the text color (muted for what's secondary); navy is only for what you can press (buttons, links, toggles, arrows) and the one marker of where you are (the current route dot, the picked card's outline). Status colors (seat tiers, delays, at risk) keep their meaning colors. An answered request's badge is green instead of navy.

## Round 137: a map key that explains itself (John)

- John: "The map key does not tell me anything.. it's just says Map Key with no other context other than the dotted lines". The folded key showed the route's line swatches and the words "Map key", and only the opened card explained them. Folded, it now lists each line on the picked route with what it means, e.g. "Likely seat, reported" beside a solid green line and "Long shot, estimated" beside a dashed amber one, then "What the map shows ›" to open it.
- Opened, it adds an "On the map" section for the marks actually drawn now, each with the map's own shape and color: the filled dot (where you leave from), the small ring (where you connect), the bold ring (where you're going), the amber house pin (your home), and the airport weather badges when the picked route has one (diamond: weather to watch; triangle: delays likely). Rows only show for what's on the map, so the key always matches it. The line color, line style and seat circle sections stay.
- John likes the round 136 stub tear, so it's unchanged.

## Round 138: aircraft type, plainer seat words, no accidental saves, no same-area routes (John)

- Aircraft type (John: "add aircraft type"): each flight box on the route card shows the type beside the flight chip ("737-800", small plane icon, muted), and the flight sheet's subtitle adds it ("DAL → ATL · Nov 5 · 737-800"). Sample flights get types each airline really flies, the bigger ones on long legs. Live: sync-schedules now keeps AeroDataBox's aircraft.model in a new `aircraft` column and live-schedules returns it; the app shortens "Boeing 737-800" to "737-800" and "Airbus A321 NEO" to "A321neo". Needs `supabase db push` (new migration 20261104000000) before those two functions are redeployed; until then live flights just show no type.
- No "~" and no "open" (John: "remove '~' from estimates and the word 'open'"): "~51 open seats estimated" is "51 seats estimated", "20 open · 17 listed" is "20 seats · 17 listed", "no open seats" is "no seats left", a typical leg's dot reads "20" not "~20", the rough drive guess reads "25m drive" (a maps-service time still says "with traffic"), the report form's field is "Seats left", and the map key says "10 seats left, 4 people listed".
- Accidental saves (John: page swipes "accidentally save the flight or accidentally swipe the perforated line"): the cause was the perforation strip's leftward pull starting at 10pt, before the card's page swipe (14pt), anywhere along the dashes. Now only a small grab tab at the right notch (64pt wide, marked with a little scissors on the dashes) starts the tear; a swipe anywhere else on the card, the dashes included, always flips routes. The pull has to go 70% of the way (was 60%), and a flick only saves past 45% (was any distance once started). A light tap as the paper starts to give tells you it's tearing. After a swipe save, a "Saved to My Trips · Undo" bar shows for 5 seconds at the bottom of the card; Undo takes it back out. The tear animation itself is unchanged (John liked it).
- No same-area routes (John: "when I go to the arrival station, it shouldn't have Dallas as an option to pick again", and "vice versa"): whichever end is set, the other end's picker leaves out that airport and every airport in its area (Dallas: DAL and DFW), in the quick picks, the full list and typed matches.

## Round 139: boarding blue, one accent pass (John picked B)

- Why it felt inconsistent: the Ice Mix navy (#1d3d84) is only 1.7:1 against the text black, so navy taps and black words read as one color; it also came in four button looks (filled, tint, outline, bare words) and sat on things you can't tap.
- The accent is now boarding blue: #1c5fd4 in light (5.8:1 on white, 3.1:1 against the text), #7aa7ff in dark; accentSoft #e6eefc / #15233f is the tint behind secondary buttons.
- One look per kind: primary is filled blue with white words; secondary buttons and soft pills are the blue tint with blue words (secondary used to be gray with black words); links are blue words; selected chips and segments are filled blue. No outlined buttons (Leave By's Use Location and Open Settings, the location card's Not Now, and Undo all use the tint).
- Off things you can't tap: the empty-state and at-airport icon tiles (gray tile, gray icon) and their bullet dots, the Leave By card's background (gray box; the car stays blue), the location card (white card with a hairline), the loading spinner, the saved mark on result rows, the mini route rings and the map's origin dot and destination ring (text ink; the map key matches). Still blue as "where you are": the current route dot and the picked card's outline. Amber stays for "you" only; seat, delay, weather and time colors unchanged.
- Middle dots: the round 138 strings ("20 seats · 17 listed", the sheet subtitle with the aircraft) go through the round 124 dividers, so they show thin bars on screen; nothing new shows a dot.

## Round 140: seat color on the route line, no chance words (2026-11-04)

John: "Can the route lines be colored with a small label centered above the route line with the availability in the same color?", "Like each leg is colored on the route line with a small label in between each leg", "We don't need the Long Shot, Likely group names anymore", "Just color and seat availability. Let the user decide on the likelihood".

- The results row's mini route line is drawn one stretch per leg, each in that leg's seat color. Over the middle of each stretch sits that leg's seat numbers ("40/2", the same form as the seat circles) in the matching text color. Every leg gets its label, even when two match. Labels shrink to fit a short leg on one line.
- Stop codes moved under their dots so the labels have the space above the line.
- Gray stretch: typical day or no seat data, a departed route, or a canceled leg.
- No chance words anywhere: the row's top-right word, the route card's chance pill, VoiceOver's "Chances:", the flight sheet's seat line, your report, an answered ask, the departures list and the report sheet now show the numbers in their seat color instead.
- The colored left edge on the row is gone: the route line carries the color now. A full route keeps its red outline; a canceled route keeps its "can't be flown as listed" chip.
- Map key: "Line color is seats left after the list" with rows 50+ seats, 15 to 49, 6 to 14, 1 to 5, No seats (thresholds unchanged from Q-074). Folded rows read like "15 to 49 seats, reported".
- "At risk" stays: it's about connection time, not seats.

## Round 141: route line gets the full width at any number of stops (2026-11-04)

John: "Flights that have more than 1 stop are squished. Is there a way we can fix this so it's consistent across the no matter how many stops?" (screenshot: DAL to LGA, a 2-stop card with "2 stops | 35m at MIA | 10h 40m" beside the line).

- The stop count and trip length moved from beside the route line to the top right of the row, next to the times, the same place the route card already keeps them. The route line now spans the whole card, so every leg gets an even share of the full width and its seat numbers and stop code have room on 0, 1, 2 or 3 stop routes.
- At big text sizes the stops line goes under the times, left-aligned.
- No "Unavailable" verdict on a canceled route, on the row or the route card: the canceled leg's own red tag says it, and the line for that leg is gray. VoiceOver still says it can't be flown as listed.

## Round 142: fix round 141's squeezed stops text (2026-11-04)

John: "No what happened. It's all messed up now" (screenshot: "Nonstop 3h 25m" wrapped letter by letter in a sliver beside the times, cards very tall).

- Cause: round 141 put the stops block beside the big times with a percent max width inside a box sized by its contents, so it collapsed to almost nothing.
- Fix: the stops, short layover and trip length are one line of their own under the times ("1 stop | 35m at DEN | 6h 40m"), left-aligned, never wrapping. The times keep the full width, and the route line below still spans the card at any stop count. Widest case measured (3 stops, a layover, a 23h trip) is about 270pt at the largest text size before stacking, inside the smallest iPhone card.
- A canceled or no-data leg shows no label over its gray stretch (it showed a lone dash).

## Round 143: canceled legs, connection risk and aircraft on the result cards (2026-11-04)

John: "Can you point out on the route line if a flight is canceled? Maybe an X indicator in the middle with a red colored line?", "Connection risk label should sit ontop of the connection station on the route line. Not to the bottom left below the airlines and flight numbers.", "I don't see the aircraft equipment type on the summary page with all the flights. I don't want to have to select flight just to see the equipment type."

- Canceled leg: its stretch of the route line is canceled red with a small X on a disc dead centre, and no seat numbers over it (was gray).
- The red "DEN → LAX canceled" tag under the flights stays: it says the word and names the flight, so the X is never read as "no seats". At risk no longer uses that slot.
- Connection at risk: a small "At risk" pill (caution violet; "Missed" when the live times break the connection) sits right on top of that stop, in its own room above the seat numbers so they never touch, and the stop's ring turns the same color. The row's tag no longer repeats it.
- Aircraft: each flight chip on the results card has its aircraft under it in small gray ("737-800", "A321neo"), one line.
- Map key: under the seat circles, a red-with-X swatch reads "Red with an X: that flight is canceled".
- Sizes measured for a 375pt phone: legs are 55pt each at 3 stops, the widest seat label needs about 49pt and the At risk pill about 41pt, so nothing overlaps. Four flight chips (3 stops) wrap whole onto a second line rather than squeeze.

## Round 144: no canceled tag on result cards (2026-11-04)

John, asked whether to keep the red "DEN → LAX canceled" tag now that the route line shows a red X: "Drop the tag".

- The slim result card no longer shows a tag for a canceled leg; the red stretch with an X on the route line says it. VoiceOver still says the flight is canceled and that the route can't be flown as listed.
- Delays and diversions keep their tag under the flights. The route card's own leg boxes keep their Canceled pill.

## Round 145: each flight under its own leg of the route line (2026-11-04)

John: "Anyway to fit the airline and aircraft underneath the route line for multiple legs? Like it's aligned underneath the route line?"

- The chip row under the route line is gone from the result card. Each leg's airline mark and flight number ("AA 1550") sit centred under that leg's stretch of line, with its aircraft under them in small gray ("737-800"). They sit below the stop codes, so a code at a dot never runs into them.
- At 3 stops (4 legs) the code beside a known airline's logo drops ("1550"), so it fits; an airline without a mark keeps its code. Both lines stay on one line and shrink a touch if a leg is short.
- Measured in the app's mono font on a 375pt phone: the flight line is 69pt against legs of 226, 113 and 74pt (0, 1, 2 stops), and 49pt against 55pt at 3 stops. The longest aircraft name ("737 MAX 8") is 60pt and shrinks to about 49pt at 3 stops; "737-800" fits as is.
- The line under the route only appears for a live tag (a delay, a diversion) now.

## Design round 146: the Delayed pill rides on its leg; bigger text, taller cards (John, 2026-11-04)

John: "The delayed pill, can that be over on top of that route line, aligned, centered on that route line that it's calling out on? ... these cards can be a little taller ... the text doesn't need to be so small to fit everything."

- A delayed or diverted flight's pill now sits above the route line, centred over that flight's own leg, in its own band above the seat numbers. A connection's At risk pill keeps its band just under it, centred on the stop, so a delay and the risk it causes never sit on each other.
- On short legs (2 or more stops) the pill shortens to "+50m" and "Diverted" so it stays inside its stretch; it can shrink a touch if it still has to.
- The tag line under the route is gone for delays and diversions; it stays only for a route whose first flight has departed. VoiceOver still says every live change.
- Bigger text, cards a bit taller: seat numbers 11 to 13, flight numbers 11 to 13, aircraft 10 to 12, stop codes 10 to 12, pills 10 to 12, the stops and trip length line 12 to 14.
- With the bigger numbers, the code beside a known airline logo drops from 2 stops up (was 3), so "1550" fits a 74pt leg; 1-stop routes keep "AA 1550".
- My Trips saved cards now draw the same route line, with each flight and its aircraft under its leg. Saved trips keep each flight's aircraft from now on; older saves just show the flight.
- Measured with the app's fonts on a 375pt phone (not rendered): "Delayed 50m" is 88pt in a 113pt leg (1 stop) and 226pt (nonstop); "21/12" is about 47pt in the 55pt leg at 3 stops; the longest stops line is under 290pt of the 318pt card.

## Design round 147: tiny seat and person icons over each leg's numbers (John, 2026-11-04)

John: "for like the seat count ... can you put like a tiny icon above each number, like one representing like a little person, and then the other one being like a seat? That will help people know like what they're looking at."

- Each leg's numbers on the result card ("21/12") now have a tiny icon over each number, in the same color: a seat over the open seats, a person over the people listed. A lone number (a typical load or seats after the list) gets the seat. A leg with no data or a canceled leg still shows nothing.
- They sit in their own short band, under any Delayed pill and At risk pill, so all three stack cleanly over a leg instead of overlapping. The card grows about 12pt taller only when a row has numbers.
- iOS draws Apple's seat and person symbols; Android uses Material's airline seat and person.
- The map key has a new "Numbers over each leg" part with both icons: Open seats, People listed. VoiceOver reads it too.
- Fit on a 375pt phone (measured, not rendered): "21/12" with its icons is about 47pt, inside the 55pt leg at 3 stops.

## Design round 148: the Delayed pill moves under the line, right over its flight (John, 2026-11-04)

John: "Okay, I really like this. So actually, can the delayed pill sit right above the airline and the flight number, but underneath the route line? I actually think it looks better there."

- A delayed or diverted flight's pill now sits under the route line, below the stop codes and right above that leg's airline logo and flight number, still centred on its own leg. The flight moves down a row to make room, only on routes with a delay.
- At risk and the seat numbers with their icons stay above the line, so the top of the card is one row shorter when a flight is delayed.
- Short legs (2 or more stops) keep the short form ("+50m", "Diverted").

## Design round 149: every time shows hours and minutes; the stops line reads in one order (John, 2026-11-04)

John: "Can we have it like say 5H and like 0M ... I just want to keep things consistent", "it's always the number of stops, the total time, and then if there's a risk, it's the last thing that's mentioned on that row", and "35M connection at MIA would work".

- Durations always show both once there's an hour: "5h 0m", never "5h". Under an hour stays "45m". This covers trip times, layovers, delays ("Delayed 1h 0m"), leg times on the map and saved trips. Ages ("3h ago") are not durations and stay as they are.
- The stops line under the times is always: number of stops, total trip time, then a short connection last, only when there is one: "2 stops · 11h 30m · 35m connection at MIA" (or "missed connection at MIA").
- With more than one short connection, only the tightest shows, so the line stays one line. Measured at 14pt on a 375pt phone: "2 stops · 11h 30m · 35m connection at MIA" is about 283pt and the "missed" form about 301pt, inside the 318pt card. It can shrink a touch at big text sizes instead of cutting off.

## Design round 150: a clearer ticket edge on the results (John, 2026-11-04)

John: "Can you add like a more obvious ticket border when I'm like scanning through the flights ... especially in dark mode ... in both dark and light mode."

- Each result ticket's edge is a full point wide (was a hairline) in a new, darker card edge color: #bfcad6 in light mode, #3a4e66 in dark mode. Against the page that is a contrast of 1.54 in light (was 1.17) and 2.22 in dark (was 1.34).
- Light mode gets a slightly firmer, tighter shadow. Dark mode drops the shadow, which only showed as a faint glow, and leans on the edge.
- A little more space between tickets (12pt, was 8pt).
- The tear notches match the new edge. Picked routes keep their blue outline and full routes their red one, both still 2pt. The tear itself is unchanged.

## Design round 151: save from the result tickets; a Canceled pill over the X (John, 2026-11-04)

John: "saving a flight and or swiping to save shouldn't actually be when you select a flight to view more details. It should be on that flight summary page instead ... We already have the space to put a save icon on the top right. And I think because you're scrolling up and down, it's very unlikely that you would swipe left unless you're intentional about it." And: "add like the canceled pill for on top of the small X ... some people may not understand what the small red X means."

- Each result ticket in the list has the Save bookmark at its top right, beside the times. Filled once it's in My Trips; tap again to take it out. The small bookmark that used to sit by the route line on saved rows is gone, since the corner one shows it.
- A swipe left anywhere on a result ticket tears it along its perforation and saves it, with the same tear (approved round 136) and the Undo bar after. The whole ticket takes the swipe, not only a small tab: in the list, a sideways move is deliberate. Up or down first is a scroll, and a tap still opens the route. Tapping Save tears it the same way. Reduce Motion saves without the tear.
- The opened route card no longer has Save or the swipe-to-tear, so reading the details can't save by accident.
- A canceled leg on the route line now has a small red "Canceled" pill above its X, centred on that leg. The X stays.

## Design round 152: a canceled ticket fades to gray (John, 2026-11-05)

John: "Canceled flights should have the red border on the card. Not when it's full with no seats. Or maybe.. something else when it's cancelled and keep the red border for a full flight." Offered a gray fade, he picked it: "Do the gray fade".

- A route with a canceled flight fades to gray like a departed one: the gray card fill, muted times and stops, the other legs' line and numbers in gray, and no shadow.
- Its edge is a dashed gray line (the faint text gray, 1pt), and the tear's notches match.
- The canceled leg keeps its red line, red X and red Canceled pill, so the one thing in color is what went wrong.
- Red still means full: a full route keeps its 2pt red edge. A route that is both full and canceled shows as canceled.

## Design round 153: solid gray edge on canceled tickets (John, Nov 5)

John didn't like the dashed border after all. A canceled ticket now has a solid gray edge, the same 1pt weight as every other ticket, and keeps the gray fade, the red X on its canceled leg and the Canceled pill. Red stays for full flights.

## Design round 154: aircraft type only on the opened route, stacked under the flight (John, Nov 5)

John: "stack the airline and equipment type like on the previous page summary. In the previous page only show the airline and flight number. Don't put the equipment type unless you select to view more." On the opened route, each leg box now stacks the aircraft type under the airline and flight number chip instead of beside it. The results tickets and saved route cards show only the airline and flight number under each leg, so the space under the route line shrinks by one line.

## Design round 155: flight stack centred under the route line (John, Nov 5)

John: "It's not aligned center underneath the route line when I open more details." On the opened route, each leg box's airline and flight number chip, with its aircraft stacked under it, is now centred across the box, under the middle of the route line, the way the results tickets centre each flight under its leg.

## Design round 156: logo-only tickets, plain map lines, dashes for no seats, colored Departed/Arrived (John, Nov 5)

- Results tickets and saved cards: each leg shows only its airline's logo under the route line, with no tile behind it and no flight number. A tap or hold on a logo opens a small window over it with the flight number and aircraft type; a tap anywhere else closes it (FlightPeek). An airline with no logo shows its code. The tail-mark fallback is drawn bare (a plane in the airline's color) instead of a colored square. Some logos from Logo.dev come with their own colored square baked in (Delta's is navy), which the app can't strip.
- Map: no map key, no dashed lines, no direction chevrons. Every selected leg is a plain solid line in its seat color. The route pulse stays.
- A leg with no seat reading shows a dash over it on the route line instead of nothing.
- Departed and Arrived pills: sky cyan (light #0b6782 on #dcf1f7, 5.5:1; dark #8adcf0 on #0e2a33). No other meaning uses cyan: blue is for things you tap, green to red for seats and lateness, violet for delays, amber for you.

## Design round 157: logo above the delay pill, "25m late" (John, Nov 5)

John: "Can the logos sit on top of the delayed pill and delay pill sits underneath the logo? Also +25m doesn't really say much." Under each leg of a ticket's route line the order is now: stop codes, the airline logo, then the delay pill. A delay reads "25m late" everywhere (tickets, the opened route, the flight sheet already used it), which fits even a 2-stop ticket's short legs (about 63pt, measured with Geist SemiBold 12, against about 69pt per leg on a 375pt phone), so the "+25m" short form is gone. VoiceOver still says "Delayed 25 minutes, was ..., now ...".

## Design round 158: logo peek on the opened route, logos closer to the line, no delay line under Leave By (John, Nov 5)

- Opened route: each flight box shows only the airline's logo (28pt, no pill) centred under its route line, with the same tap-or-hold window as the tickets for the flight number and aircraft type. The box's spoken label now includes the aircraft. Tapping elsewhere in the box still opens the flight sheet.
- Tickets: each leg's logo moved up to sit just under the line, level with the stop codes beside it (a logo centred on its leg clears the codes centred on the dots, even on a 2-stop ticket); a delay pill sits right under the logo.
- Leave By card: the "Flight delayed to 5:35 PM" line is gone; the route's own times show the change. VoiceOver still hears it with the title.

## Round 159 (2026-11-05, John)

- Opened route: no "Continuing to SEA" note on a diverted leg. Every leg box now has one layout: both airport columns are a fixed 74pt (the width of "10:40 AM"), the line is always raised the same amount, any status pill sits over the line and the flight's length is always under it. So lines start, end and sit at the same height in every box.
- Leave By before the airport: "Arrive at DFW by 10:10 AM to begin boarding" (airport and time from the data), with nothing beside it. Leave now's detail ends the same way.
- At the airport: "Your flight begins boarding at 11:40 AM". The time is still the scheduled departure, since we have no boarding time data.
- At the airport the card opens walking directions (Apple Maps dirflg=w, Google walking) to "DFW Terminal C Gate C12", built from the first flight's live gate and terminal. The car becomes a walking person with the gate under it. No gate posted yet: the person alone, routed to the terminal or airport. Whether the maps app finds the gate depends on its indoor map for that airport.

## Round 160 (2026-11-05, John)

- No "Follow your airline's rules on sharing loads" line anywhere: gone from the bottom of results and from Profile. The report sheet keeps only "Reports are anonymous to other employees."
- The notes over the results ("Leaving from any Dallas airport (DAL, DFW)", the summary and the like) are centered.
- Replaces the round 152/153 gray fade: a canceled nonstop gets a 2pt red edge (canceled red) and a light red wash over the whole card (canceledTint, light #fef1f2, dark #24141d), with gray top times. A 1, 2 or 3-stop route with a canceled leg is left as a normal card, with only the red X and Canceled pill on that leg's line.

## Round 161 (2026-11-06, John)

- Ticket logos drop 6pt under a route with a canceled leg so they clear the X's disc.
- A canceled nonstop's gray top times get a red line through them (textDecorationColor canceled).
- Every airline mark is the same round badge: a white disc with a hairline ring that the logo fills (cover), or the airline's color with a white plane when there's no logo. A square logo like Delta's reads as a circle. The disc is always white, so the logo is asked for in its light form.
- Area notes name the state: "Leaving from any Dallas, TX airport (DAL, DFW)" (country code outside the US).
- No red edge on a full route; it keeps the gray fill and the plain edge. Red edges are only for a canceled nonstop.
- No late pills on results tickets; the opened route keeps them. A diversion still shows on the ticket.
- A leg with nothing reported shows the seat icon over a dash.

## Round 162 (2026-11-06, John)

- Boarding time, since no feed gives one: 40 minutes before a domestic departure, 50 before an international (airports in different countries) or widebody one (747, 767, 777, 787, A330, A340, A350, A380, MD-11, DC-10; not the 757). "Your flight begins boarding at" uses it. Widebody detection needs the aircraft type, so until real flights carry it, a domestic widebody gets 40.

## Round 163: premium pass on the less-touched screens, part 1 (John, Nov 6)

John: the home screen, results and flight details have had all the attention; the station picker, Settings, Trips, the Logbook and the other menus need the same premium pass.

Audit of screens not yet polished: Airport picker, Settings, Trips, Logbook (totals card, logged flight rows), Feed and request rows, Add flight sheet, Report sheet, Filters, Departures sheet, Profile, Date picker, Pass scanner, the tab bar.

This round:
- One shared card look (`useCardSurface`): surface fill, card-edge border, 1pt, medium radius, and a soft lift in light mode only. ListGroup, EmptyState, the Settings groups, SavedRouteCard edges and the Logbook totals card all use it, so every list screen matches the results tickets.
- Airport picker: each section is one rounded card of rows with inset hairlines; the code sits in a mono pill; the airport name is in text color with "Dallas, TX" under it; amber tags are now round pills; the search field uses the card look. Search finds a city or a state too, as the placeholder already promised.
- Logbook totals: the highlights are rows (icon, label left, answer right, miles or flights muted) instead of plain sentences. VoiceOver reads the same.
- Settings keeps its structure so the App Store thread's Account section merges cleanly; no auth screens here.

Not rendered here: sizes checked against the fonts only.

## Round 164: premium pass part 2, Feed and requests (Nov 6)

- Every request row (Feed and My Trips) leads with the same round airline badge as the tickets.
- An answered request shows its numbers the way the route line does: a pill in the seat color with the seat icon and open seats, a slash, the person icon and people listed, then "answered 2m ago" in gray. No tier dot, no sentence of numbers. VoiceOver still reads "20 seats, 17 listed, answered 2m ago".
- Answered and Waiting badges are round pills with semibold text, like the other pills.

## Round 165: premium pass part 3, the sheets (Nov 6)

- Report Load: the two number cards and the tier box use the shared card look. Each count card has the same seat or person icon as the route line, in a small circle by its label. − and + are secondary buttons now (light blue tint, blue glyph). Once you set numbers, the tier box fills with the seat color. The flight line under the header leads with its round airline badge.
- Add flight: the form card and the Scan / Photo tiles use the card look; the tile icons sit in a light blue circle so the tiles read as buttons.
- Departures board: one rounded card of rows with inset hairlines, like the airport picker. Each flight leads with its airline badge, and "You reported" shows the same seat-colored count pill as an answered request (shared SeatCountPill).
- Filters: Max stops is one segmented track with the pick filled blue and the others in blue text. Steppers everywhere (Filters, Settings) use the secondary tint for − and +.

## Round 166: premium pass part 4, Profile, date picker, scanner, tab bar (Nov 6)

- ListRow takes an optional icon: a small rounded tile in the quiet fill with the icon in text color (not blue, since the tile isn't the button; the row is). A hairline under a row with a tile starts at the text, like iOS Settings. Profile's setup rows (home, other homes, location, notifications, buffer, directions, search defaults) and About rows use it.
- Tab bar: the picked tab shows its filled icon; the bar's top line uses the card edge.
- Date picker: the calendar sits on the shared card, with the note centered under it.
- Pass scanner: four white corner brackets frame the pass instead of a full box; the hint is a rounder dark pill; the camera ask leads with a camera in a light circle.
- Settings' structure is unchanged, so the App Store thread's Account section still merges cleanly.

## Round 167: Requests tab, My Trips cleanup (John, Nov 6)

John: "Add badges to open requests on the feed tab and rename the feed tab to 'Requests'", "sorted by oldest from the top so that those get answered quickly", "When it was asked the text gets wrapped onto the 2nd row", "swipe left to delete a saved route or multiselect to delete", "Saved routes should also auto delete after 24 hours when the last leg of the route arrives", "Your requests answered should stay until the last leg of your request arrives and it's been 24 hours", "Your Requests and Saved Routes should have a better design to separate both".

- Feed is now Requests (tab and screen). The tab shows a count badge of asks still waiting for your answer (system red, the iOS meaning). Answers you give live in RequestsProvider so the badge drops as you answer.
- Open asks sort oldest first.
- Request rows: when it was asked (or answered) sits on its own at the right, over the Answer button or the Waiting/Answered pill, so the departure line never wraps. At 393pt wide the departure line has about 195pt; "Departs tomorrow 10:55 AM" measures 158pt in Geist Medium 12.
- Saved routes: swipe left slides the card over a red Delete (a long swipe or hard flick deletes at once; a short one stays open on Delete; a tap on the card closes it). After a swipe delete, "Route deleted" with Undo shows for 5 seconds. Select in the section header turns on checkboxes and a bottom bar with Select All and a red Delete N, which confirms first. The trash button stays for VoiceOver.
- Saved routes come off by themselves 24 hours after their last flight lands (checked on app open and each time My Trips shows). Answered asks stay in Your requests until 24 hours after their flight lands; waiting ones still go when the flight leaves.
- My Trips sections have real headers: an icon in a circle, the name at 20pt, a count pill, and the section's action on the right; a rule and space sit between Your requests and Saved routes.

## Round 168: App Store work ships with the design rounds

John saw no launch screen in Expo Go. Cause: the publish workflow sends each git branch to its own Expo Go branch, and John opens `claude/project-thread-fzqwou`. The animated launch intro, welcome page, sign up and log in, Delete Account, legal pages and report tools were built on `claude/app-store-ready`, so they never reached the update he opens.

Fix: merged `claude/app-store-ready` into the design branch (clean merge, no conflicts). From now on every design round merges the latest `claude/app-store-ready` before it pushes, so both sets of work publish together.

Checked in code and tests (not on a device): `LaunchIntro` plays once per cold start over the app, then lifts onto the welcome page. Expo Go builds are `preview`, so "Look Around First" shows and opens the tabs, and it's remembered so later launches go straight in after the intro.

## Round 169: smooth launch exit, Leave By reads as a button

- Launch intro exit (John: "It looks choppy when it's coming off the screen. It looks awesome though"). Cause: every frame of the lift was a JS re-render of the whole intro while the app mounted underneath, so frames dropped. Now the drawing freezes at take-off and the plane's flight and the panel's lift run as native-driver Animated timings (same curves as before), so the JS thread being busy can't stall them. The plane sits on its own layer so it can fly without redrawing. The exit is a bit longer (520 to 640ms) so the lift glides. Reduce Motion's fade runs natively too. Whole intro is 2.44s.
- Leave By (John: "doesn't look obvious to select and can the estimated time to drive there be next to the car icon or walking icon"). The car is now a filled blue capsule button with the drive time beside it ("🚗 32m"), also on "Leave now" when the drive is known. At the airport the capsule holds the walking person and the gate; there's no walking-time source, so no walk time is shown. The title stands alone ("Leave by 10:45 AM"); the arrive-by line stays in the spoken label. Measured: "Leave by 10:45 AM" 126pt + "1h 15m" capsule 93pt fits the ~330pt row.

## Round 170: curved map route lines

John: "None scrap this idea" (destination art on tickets: dropped, nothing built). Then: "Can you make the route lines curve or look more natural free flowing than a straight line?"

- Map: the arcs were already lifted great circles, but on a domestic leg seen from above the lift points at the camera, so they read as ruler lines. Each leg now also bows sideways by 13% of its length (BOW in arcs.ts), toward the nearer pole like a flight map; legs within 45 degrees of due north or south bow east. Both directions of a pair bow the same way, so a round trip reads as one curve. Ends stay exactly on the airports. Everything drawn from the samples follows: lines, ground shadow, time pills, tap targets, and camera framing (legFramePoints uses the bowed path). Map rules kept: plain lines in seat colors, no dots, arrows or legend.
- Cards: mocked up only (outbound-frames/r170_card_line_options.png): A soft arch per leg, B one flowing wave. Not built until John picks.
- Frame: outbound-frames/r170_map_curves.png, drawn from the app's own projection on the dev sample routes.

## Round 171: route lines flow instead of arching

John (Nov 7): "The arch is too much. Not every line also has to be an arch. I just want it to look like it flows nicely."

- Map: the sideways bow drops from 13% of the leg to 4%, and only a lone nonstop keeps it. Legs that meet at a stop lose the bow and instead lean gently (at most about 17 degrees) so the line runs through the stop with no corner. Most lines now read nearly straight.
- Cards: connections drift 2.5pt off straight in one low wave that passes through every stop dot, alternating up and down per leg. Nonstops stay straight. Seat numbers, stop codes and the canceled X stay put (the X follows the line by its drift).
- Drawn from the app's own numbers (r171_map_flow.png, r172_card_flow.png), not seen on a device.

## Round 172: straight route lines again

John (Nov 7): "No I dont like it go back to straight lines haha"

- Map and card route lines are back to straight, exactly as they were before round 170 (arcs.ts, framing.ts, GlobeMap.tsx and MiniRoute.tsx restored; the card flow test removed).
- Rule going forward: route lines stay straight. Don't revisit curves unless John asks.

## Round 173: Appearance setting (Light, Dark, System)

John (Nov 7): "Can you create a a system toggle for light/dark/system mode and automatically set the system mode by default"

- Settings has an Appearance section (after Location) with three segments: Light, Dark, System. System is the default and follows the phone. Profile shows it as its own row that opens Settings there.
- Saved with the other settings on the phone. Reset and Delete Account bring it back to System.
- One switch for the whole app: every screen already takes its colors from useColorSchemeName, which now reads the choice first and the phone only for System. Appearance.setColorScheme makes the phone's own parts (keyboard, alerts, date pickers, status bar) match too.
- The saved choice is read before the first screen draws, so the app the launch intro lifts off is already in the right mode with no flash.
- The launch intro itself stays the icon's ink blue in every mode, same as the phone's splash screen, which can't read an in-app setting.
- Not seen on a device.

## Round 174: five new filters, airport summary, Settings tab

John (Nov 7): "Time of day filter, Airports to avoid, Only answered loads, Airline filter, US airlines only or all ... Can you also build these additional filters", then "The airport summary should be when you select an airport or hold to select it", then "Profile tab should be renamed to Settings and Cog icon ... Organize it logically".

Filters (Filters sheet and Settings > Search defaults, saved like the rest):
- Time of day: Morning 5 AM to 12 PM, Afternoon 12 to 5 PM, Evening 5 to 9 PM, Night 9 PM to 5 AM, any mix. Judged by the first flight's local departure. None picked = any time. Window bounds are provisional.
- Airlines: All airlines or US airlines (segments), then airline pills with logos. Picked airlines must fly every flight; none picked = every airline. US only hides and drops foreign airlines. US list = mainline plus the regionals flying for them; an unknown code counts as not US.
- Loads: Only answered loads = every flight has a crowd-reported load (source 'reported').
- Airports to avoid: removable pills plus Add Airport. No connection there, and an avoided area airport is skipped at either end; the airports typed in From and To always stay.
- The empty-list "your filters hid N routes" count loosens these too.

Airport summary:
- Hold an airport (From/To card, an airport pill on an opened route, a row in the airport picker) for a sheet with local time, public transit, hours and rental cars. VoiceOver gets an "Airport info" action.
- Facts for all 12 airports were checked on each airport's or transit agency's own site on Nov 7, 2026 (sources in design/airport-info-sources.json). What couldn't be confirmed says "Couldn't confirm this one yet" instead of guessing: hours for DAL, DEN, DFW, LAX and LGA. Most airport sites list TSA checkpoint hours rather than terminal hours, so that's what Hours shows.
- Moves to the schedule DB later, so new airports get their own facts.

Settings tab (was Profile, cog icon):
- Groups: Account, Home airports, Getting to the airport (buffer, directions app, location switch), Search (search defaults), Display (Appearance segments, Rain radar switch), Notifications, Help and legal, About (credits, version, Logo.dev), then Reset All Settings.
- On/off and pick-one settings change right on the tab; anything bigger opens a page with just that section.
- The route keeps its file name (profile) so links don't break.
- Not seen on a device.

## Round 175: Departed and Arrived in the flight card's corners

- John: "On the flight summary page can the departed pill stay on the bottom left of the card and arrived pill on the bottom right of the flight card?"
- Each leg box on the opened route card now ends in one row: a left corner, the airline logo centred, a right corner. The corners are even (flex 1 each) so the logo stays centred.
- Departed sits in the bottom left corner (under where it left from), Arrived in the bottom right (under where it landed), every time. They no longer sit over the route line.
- Late, Canceled and Diverted pills keep their place over the line; the corners stay empty then.

## Round 176: Membership plans and credits (demo), Departure Time filter

- John: pick a membership tier from the main menu: Free, Pay as you go or Premium. Free sees itineraries but no seats until requested; a request goes straight to My Trips with dummy loads. Pay as you go and Free show credits on the main menu with the same icon; Free earns credits by answering loads. Premium sees every load, no credits.
- The plan picker opens on the Search tab once the launch intro is done, until a plan is picked. Later closes it until next launch. The plan is kept with the settings (so Reset All Settings asks again) and changes any time under Settings > Membership.
- Seats hide by taking them off each route before it reaches the screen, so tickets, the route card and the flight sheet all show "-" and gray lines. A note under the results count says why.
- Opening a hidden route shows a "Seats are hidden" card above Leave By. Request Loads spends 1 credit, unlocks that route's flights for good, adds each flight to My Trips already answered with sample loads (the sample seats search has, else steady made-up numbers), saves the route and opens My Trips. Out of credits, the card offers Answer Loads (Requests tab) instead.
- Credits: Free starts with 3, Pay as you go with 10, once per plan. Answering a load (Requests tab or Report Load) earns 1, once per flight. The ticket chip on the Search top bar shows the balance; a tap opens Credits: balance, earned, spent, how it works, recent entries, Answer Loads. Premium has no chip. No buying: Pay as you go says adding credits comes later. Everything is kept on the phone; nothing is charged.
- John: rename "Time of day" to "Departure Time".

## Round 177: Credits say "credits", the day picker says what it is

- John: "add some labeling to the credit icon. It's not obvious from a first look." The chip on the Search top bar now reads "3 credits" beside the ticket icon.
- John: "It's not obvious that you can switch days or that's what it means." The results header's day stepper (arrows either side of the date) is now a labeled day picker: "Departing Tue, Oct 20" with the route count beside it, over a row of day buttons for the whole 0-7 day window (Today, Tomorrow, then weekday names, each with its date). The searched day is filled blue, the others light blue, so each reads as a button. The row scrolls to keep the picked day in view. VoiceOver reads it as a "Departure day" radio group.

## Round 178: map and launch animation missing (fix)

- John, after round 177: "I can't see the map and the loading screen only loads the words." Both are drawn with Skia, and neither file changed in rounds 173 to 177.
- The only change in those rounds that reached native views was round 173's Appearance choice calling Appearance.setColorScheme, which sets a light/dark override on every app window. In Expo Go that override stays on the windows across reloads of an update. It's the prime suspect; not confirmed on a device.
- Fix: the Appearance choice no longer sets the phone-level override. Light/Dark/System still changes every color in the app (useColorSchemeName). Launch clears any override an earlier version left, once. The phone's own parts (keyboard, alerts) follow the phone's setting again.
- Confirmed Nov 8: John, after round 178: "They're back". Never set the phone-level override again.

## Round 179: arrows beside the day buttons

- John: "New row of day buttons are not obvious to scroll left and right ... add arrows but keep the buttons like that".
- The labeled row of day buttons stays as is. A light blue arrow button sits at each end of the row (chevron left / right, full button height so it lines up with the days).
- An arrow steps one day and searches it, same as tapping that day; the row scrolls to keep it in view. Each arrow dims at the end of the date window.
- Screen readers hear "Previous day, <day>" / "Next day, <day>".

## Round 180: whole day buttons only; the yaoom sound is made

- John, on round 179's screenshot: "Why do the arrows overlap with a date? That doesn't look good." The row cut the next day button in half at its edge, right beside the arrow.
- The row now measures the space between the arrows, fits as many whole buttons as there's room for (each at least 80 wide), and sizes them to fill it exactly. Swiping snaps one whole button at a time; the arrows and taps move the row just enough to keep the picked day in view. No button is ever cut off.
- John also asked for a "yaoom" sound when a request is answered. assets/sounds/yaoom.wav is an original sound made from scratch for OutBound (a voice-like "ya-oom" with a low boom under it); no artist's audio is used or sampled.
- Playing it needs Expo's audio package (expo-audio), which isn't in the app yet. Adding a package waits on John's yes, so the sound isn't wired up this round. Plan once he says yes: play it when one of your asks gets its answer, follow the phone's silent switch, mix with other audio, and add a Sound effects toggle in Settings.

## Round 181: the yaoom plays, and changing days is smooth

- John said yes to adding Expo's audio package ("Yes add it"). expo-audio ~58.0.10, the version bundled with SDK 58, so it runs in Expo Go. Not added as a config plugin, so the app asks for no microphone permission.
- The yaoom (assets/sounds/yaoom.wav, original) plays when one of your asks gets its answer. Asks already answered when the app opens stay quiet. A requested route whose legs all land at once plays it once.
- It follows the phone's silent switch (playsInSilentMode false) and mixes with other audio, so music keeps playing.
- Settings > Display has a "Sound effects" switch ("A yaoom when your request is answered"). On by default.
- John: changing days with the arrows "looks choppy ... like it's glitching out". Cause: each day change swapped the whole list for a loading view and back, which also rebuilt the day row (it snapped back to its first spot, then jumped). Now, while a new day loads for the same market, the last day's routes stay in place, dimmed and untappable, the count reads "Finding routes…", and the day row stays put and scrolls smoothly. The new day's routes rise in when they land. Reduce Motion skips the fade.
- The day row is hidden for the one frame before it's measured, so buttons never jump between widths.

## Round 182: the yaoom, made easier to hear

- John, Nov 9: "I also dont hear the yaoom sound".
- Most likely cause: his phone is on silent (the bell with a slash shows in his round 179 screenshot), and the yaoom follows the silent switch, so iPhone mutes it. Not confirmed on his phone.
- Also hardened: the sound now loads when the app starts instead of at the moment of the answer, and a fresh player plays straight away (it only rewinds after it has played once). Before, the first play could wait on a cold load and a rewind of a player still loading.
- Turning on Settings > Display > Sound effects now plays the yaoom once, so there's a quick way to hear it on any plan. The row says it's quiet on silent.
- Still respects the silent switch. Asked John whether it should play on silent too.

## Round 183: the real reason the yaoom was silent

- John, Nov 9: "Im turning it on and off and my phone is not muted I cant hear it". So it wasn't the silent switch.
- Cause (found in the code, not yet confirmed on his phone): the yaoom was a bundled file. In Expo Go, an update keeps its files under bare content hashes with no file extension (expo-asset's own notes call extensions "legacy"). iPhone's player decides what a local file is from its extension, so it couldn't open the yaoom, failed without an error anyone could see, and nothing played. expo-audio's source even notes that AVPlayer fails when the type can't be inferred.
- Fix: on iPhone the yaoom now comes from a data URI (AAC, audio/mp4, about 11 KB) built into the code. expo-audio writes it to a temp file with a real audio extension, so the player always knows what it is. Android keeps the bundled file (now assets/sounds/yaoom.m4a). The original WAV moved to design/yaoom-source.wav.
- If it ever fails to load again, Settings shows a line under Display saying it couldn't load and why, instead of staying silent.

## Round 184: see what the yaoom is doing, and let it play on silent

- John, after round 183: "Still nothing", and no failure line under Display. So either his Expo Go isn't on round 183, or the player loads and plays but nothing comes out.
- Settings > About now has a "Design round" row (src/buildInfo.ts, bump each round) so we can see which update his phone loaded.
- Under Display, while Sound effects is on, a "Sound check" line always shows what the yaoom last did: not loaded yet, loading, loaded, playing now, last played at a time, or couldn't load and why. Temporary, until the sound is confirmed on his phone.
- The audio mode is now set and waited for before the player is made (before, the first play could run before the mode applied).
- The yaoom now plays even with the phone on silent (playback category, mixed with other audio so music keeps going). His Nov 8 screenshot showed silent mode on; on recent iPhones that's set from Control Center or the Action button, not a side switch, so "not muted" may not mean silent is off. The Sound effects switch turns it off.
- Each yaoom also gives a success tap you can feel.

## Round 185: a long yaoooooom

- Round 184 worked: John can hear it. His next ask: "Can the sound effect be more.. yooooom. Like yaoooooooooooom".
- Remade from scratch (design/yaoom-source.wav): 2.4 seconds instead of 0.8. A quick "ya", then the "ooo" held for over a second with a slow vibrato that grows in, then it closes into a soft "m". The low boom sits under the whole "ooo" and fades slowly with it. Still original, no artist's audio.
- Still built into the code for iPhone (AAC, about 30 KB).
- The Sound check line under Display now only shows if the yaoom fails to load. Design round stays in About (now 185).

## Round 186: yoooom with an autotuned ooo

John: "Delete the a in Yaoom sound effect. It should sound like Yooooooooom. And adjust the ooooo to have an autotune effect."

- The "a" opener is gone: the y glides straight into the ooo in about 0.14 s.
- The ooo is sung down from E4 toward F#3 with a wide vibrato, then snapped to E minor pentatonic with a 5 ms retune, so it steps between notes and flips back and forth at each change (the hard autotune warble) instead of sliding.
- Light doubling (two voices detuned 9 cents) gives it the processed-vocal sound.
- Same 2.4 s length, same low boom under it, same "m" close. Made by design/yoom-synth.py; the app's code names (playYaoom) stay, only what you read says yoooom.

## Round 187: more autotune

John: "More autotune".

- Retune is now instant (1 ms instead of 5 ms), so every note change is a hard snap.
- Vibrato is wider (2.6 semitones) and faster (6.2 Hz) with a slow sway on top, so the ooo flips between notes about twice as often.
- A brighter, buzzier voice and a second autotuned voice a fifth above, like stacked T-Pain harmonies, plus octave doubling.
- Still no "a", same 2.4 s length, boom and "m" close.

## Round 188: two people building

John (Nov 10): "I want to be able to make changes both him and I. Do what is best to make it happen." A friend joins with his own Claude, as a GitHub collaborator and an Expo member.

- `CLAUDE.md` is now the guide every Claude reads first: how the two of them work together (start from the latest main, own branch, small PR for every change, John merges, nothing left unmerged at the end of a session, check open PRs before touching a screen) and John's design rules in one place. `AGENTS.md` points to it.
- Expo Go now publishes every branch that's pushed, not just main and the design branch, so each person can try their own work on a phone.
- Design rounds now go out as small PRs that merge often, so main stays current for whoever works next.

## Round 189: load requests cost 1 credit per leg

John (Nov 12): "it should be 1 credit per leg. Not route. It should be easy to select which legs in a route you want to request loads for. Maybe have a 'quick request' button on each leg so that I have the option to either request the full route or select single/multiple legs at a time. The number of credits per route/leg should be clearly visible."

- A request costs 1 credit per leg. Requesting legs that were already requested costs nothing.
- The Seats are hidden card says "loads are 1 credit per leg". On a route with more than one leg it lists each leg (codes and departure time) with its own quick request pill, "1 credit". A requested leg shows a gray check and "Requested" instead.
- The filled main button requests every leg still hidden and names the cost: "Request All Legs, 2 credits" (a nonstop: "Request Loads, 1 credit"). It shows only when you have enough credits for all of them; otherwise the note says how many legs you can afford ("You have 1, enough for 1 leg.") and you pick legs one at a time. Once one leg is left, its quick request is the only button.
- A requested leg shows its seats right away, even while the route's other legs stay hidden. A request that finishes the route opens My Trips as before; one that leaves legs hidden stays on the route.
- The credits sheet, Settings line and results note say per leg.

## Round 190 (Nov 12): request loads from the pass itself

John: "Having it split like this is redundant. Rework this. I want to see the whole boarding pass layout with a large 'request all legs for X credits' button that is static at the bottom (above the menu bar). Then each leg has a credit box on it that is already checked off. Deselecting the legs/check boxes adjusts the total request amount and button at the bottom."

- The separate request card under the pass is gone. The open route shows the whole pass.
- Each leg with hidden seats has a "1 credit" checkbox in its box's top right corner, checked by default. Requested legs show their seats and no box.
- One large filled button pinned at the bottom of the screen, above the tab bar: "Request All Legs for 2 credits" when every hidden leg is checked, "Request 1 Leg for 1 credit" when some are unchecked, "Check a Leg to Request" (disabled) when none are.
- A small line over the button says the price per leg and your credits, or how many legs your credits cover when you're short. Out of credits: the button becomes Answer Loads.
- The route scroll leaves room at the bottom so the pinned button never covers the pass.

## Round 191 (Nov 12): Departed and Arrived back on the route line

John: "Departed and Arrived buttons should actually sit ontop of the route line ... instead of the bottom right below the time. I don't like that it creates this stacked look with the credit toggle to select. Align the subtext above the request all legs button as well."

- On the opened route, Departed and Arrived sit over each leg's route line like every other status pill (replaces round 175's corners). The bottom row is just the airline logo with the credit checkbox on the right.
- The "Seats are hidden..." line over the pinned request button is centred to line up with the button.

## Round 192 (Nov 12): pills in order, no requests for canceled legs, credit wording

John: "Remove the 'Seats are hidden' ... when you are searching a market. Change the text on remaining credits 'You have 14' to '14 credits remaining'. Why does the Arrived pill show for the 2nd leg but the first leg it doesn't say Arrived either? ... these pills should make logical sense. If a flight is canceled there should be no way to request the loads for that flight. It would be a waste of a token."

- Results list: no "Seats are hidden on Pay as you go..." line under the search header.
- Pinned bar note: "Seats are hidden. Loads are 1 credit per leg. 14 credits remaining." Short: "1 credit remaining, enough for 1 leg. Uncheck the rest."
- Pills follow the clock: an actual takeoff that has passed is Departed, an actual landing that has passed is Arrived, and a flight an hour past its expected landing is Arrived even if the feed never moved it on. Never from the schedule before then, so a late flight that hasn't left stays late. Canceled and diverted stay.
- Pills follow each other: when a later leg has left, an earlier on-time or departed leg that should have landed reads Arrived (or at least Departed). A delayed, canceled or diverted earlier leg keeps its own pill.
- Sample statuses move on with the clock too (they used to stay on time forever), which is what made leg 1 sit blank next to an Arrived leg 2.
- No credit box and no part of the request total for a canceled leg, nor one that has departed, arrived or diverted (no seat left to get). A route with nothing left to board shows no request button.

## Round 193 (Nov 12): every Leave By shows the boarding line

John: "Why do some have the Leave By time but no description about the arrival time to boarding and some do?"

- Cause: since round 169 moved the drive time onto the car button, a "Leave by 3:10 PM" card had nothing beside its time, while "Leave now" kept "Arrive at DFW by ... to begin boarding". Which one you saw depended on whether it was already time to go.
- Now "Leave by" shows the same "Arrive at DFW by 4:05 PM to begin boarding" line beside (or under) its time. With no location the card's title is that line already, and at the airport it says when boarding starts.

## Round 194 (Nov 12): fart sound, routes grouped in My Trips, tidier results header

John: "Remove the yaoom sound effect and do a fart sound effect." / "When I request a route and I go to my trips. Can you group that route and not treat them as single flights." / "You also don't need it to say Departing Thu, Nov 12 text above the date selected. That's redundant. Move the number of routes and how many are full next to the text where it says Leaving from ... Have it off to the right."

- The answered-request sound is now a fart (original, made by design/fart-synth.py; 1.35 s, buzzy and wobbly with a sputter and a squeaky rise at the end). The yoooom files are removed. Same trigger, same Settings > Display > Sound effects toggle (plays once when switched on). Settings detail: "A fart when your request is answered".
- My Trips > Your requests: legs requested from a connecting route sit together in their own card under the route's name ("DAL TO DEN TO LAX, 2 LEGS"), in flight order. Lone flights share one card. Requesting a route's other leg later joins the same card.
- Results: no "Departing Thu, Nov 12" line over the day buttons (the picked day button already says it). The route count ("10 routes, 1 full") sits on the line over the tickets, off to the right of "Leaving from any Dallas, TX airport (DAL, DFW)".

## Round 195 (Nov 12): a real fart then a moan, delete your requests, count pills

John: "It just sounds like distorted bass. Can you make it more of a fart and add a separate moan noise." / "I should also be able to remove some requests that I've submitted. I can't delete those." / "the number of routes listed and how many are full, can we change that from just text to like a pill? Right now it kind of blends in."

- The fart is rebuilt (design/fart-synth.py, 1.42 s): irregular puffs that ring in the mids (330 to 2300 Hz) with air and wet pops, instead of a low buzz. Slow opening flaps, a main rip, a catch, a second push, wet flaps and a squeak at the end. Almost no energy under 150 Hz now.
- A separate moan (design/moan-synth.py, 1.7 s): a comedic relieved "uhhh-ahhh" voice, its own clip and its own player, starting 1.55 s after the fart (just after it ends). If the moan can't load, the fart still plays. Settings detail: "A fart, then a moan, when your request is answered".
- My Trips > Your requests: swipe left to delete a request, or a whole requested route (all its legs). "Request deleted" / "Route deleted" with Undo, like saved routes. Select on the Your requests header picks requests or routes, Select All, Delete N with a confirm. Saved routes keep their own Select; only one section selects at a time.
- So each one swipes on its own, a lone flight now has its own card (round 194 had lone flights share one).
- Requests tab is others' asks to answer, not yours, so nothing to delete there.
- Results header: the count is now pills on the right of "Leaving from ...": a gray "10 routes" pill and a red "1 full" pill only when some are full. Not blue (blue is for tappable things). VoiceOver reads "10 routes, 1 full".

## Round 196 (Nov 12): shorter report banner, status pill up top

John: "Remove 'Pick yours from the board'. Move the Departed and Arrived pill to the right of the new scheduled time if it's changed or original scheduled time. I think it looks better at the top portion of the ticket."

- The "At DAL? Report a load" banner now reads just "7 departures in the next 5 hours."
- Results tickets: the Departed or Arrived pill sits on the big time line, right of the times (the new times when they moved, under the struck schedule). It no longer sits alone at the bottom of the ticket. The bookmark stays top right.
- The opened route keeps each leg's own pill over that leg's route line (round 191), since a connection's legs can be in different states. CLAUDE.md updated.

## Round 197 (Nov 13): subtle chimes on three key moments, no more fart or moan

John: "Can you remove the current sound effects loaded on the app? Lets redo some sound effects that would make sense on this app and keep it subtle to very key specific actions."

- Removed: the fart, the moan, their synth scripts, recordings and data files.
- New set (design/chimes-synth.py, original soft bell tones, mixed quiet at -14 to -17 dBFS peak):
  - answered: two notes rising (E5 then B5), about 1.1 s. When a load request you made gets its answer. Comes with a success tap.
  - sent: one light high tap (A5), 0.35 s. When you press Request on the pinned bar and credits are spent. The answered chime waits for it to finish (the demo answers at once).
  - leave: three notes falling (G5, E5, C5), like a gentle terminal chime, 1.5 s. When the Leave By card turns from "Leave by" to "Leave now" while it's on screen. Never when a card opens already saying Leave now.
- Nothing else makes a sound. The same chime twice within 2 s plays once. Settings > Display > Sound effects still turns all of them off and plays the answered chime once when switched on. Detail: "Soft chimes when a request goes out, when it's answered, and when it's time to leave". CLAUDE.md has the rule.

## Round 198 (Nov 13): animations that mean something, one corner radius

John: "Give animations throughout the app that mean something." / "One corner radius everywhere." / "Unique clean font too."

Animations (src/ui/motion.ts, Pop.tsx). Each shows what just changed or where something went. None on first show; Reduce Motion fades only.
- Status pills (Delayed, Departed, Arrived, Canceled, Diverted) settle in when they change, so a flight moving on is noticed.
- The credits chip's number rolls: down from above when credits are spent, up from below when earned.
- A leg's credit tick settles in or out as you check or uncheck it.
- A leg that turns canceled while on screen draws its X: the disc settles, then the strokes grow from the middle.
- New seat numbers on a leg settle in when the load changes.
- My Trips: when a request or saved route is deleted, brought back with Undo, or deleted in Select, the cards around it glide into place instead of jumping.
- The My Trips tab icon settles in each time a request lands there, so you see where it went.

One corner radius: `radius.all` = 14 for every card, ticket, leg box, button, field, sheet, banner, popup, tile and checkbox (before: 12, 18 and 26, plus 4 to 20 one-offs). Pills (`radius.pill`) and circles (logo badges, dots, round icons) stay round. Inner clips keep 1 less so they sit inside a border. CLAUDE.md has the rule.

Font: picked Manrope (Google Fonts, open license; distinctive, very readable small, tabular numbers), with Plus Jakarta Sans and Figtree as alternates. Adding it needs a new font package, which needs John's OK first, so it isn't in this round. Geist stays for now.

## Round 199 (Nov 13): Manrope everywhere, canceled legs on the map

John: "Add Manrope." / "Route map should indicate in some way this leg is canceled."

Font: added @expo-google-fonts/manrope. All text and titles are Manrope (400 to 800); bold text and the map's IATA labels too. Times, flight numbers and other figures that must line up stay Geist Mono; the OutBound wordmark stays Big Shoulders. Geist's package is no longer used by the app but is left in place for now.

Canceled leg on the map (selected route only):
- The canceled leg's line is red (the `canceled` token), solid, no seat color and no glow, since nothing can be boarded.
- A small red X sits at the middle of that line on a little disc, the same mark as on the cards' route line.
- Its flight-time pill becomes a red "Canceled" pill (the cards' Canceled pill colors) just above the X, or below it when above is blocked. Never on the line itself.
- On a connection only the canceled leg changes; the other legs keep their seat colors and times.
- No pulse on a canceled leg. VoiceOver reads "ORD to LGA, canceled".
- Still no legend, no dotted line, no arrows. CLAUDE.md has the rule.

## Round 200 (Nov 13): Sora replaces Manrope

John couldn't see a difference after round 199 ("i cant tell a difference"). Manrope and Geist really are near twins at app sizes. He was shown four samples in OutBound's own text (Space Grotesk, Sora, Bricolage Grotesque, Manrope) and picked "Sora".

- Added @expo-google-fonts/sora, removed @expo-google-fonts/manrope. Sora 400 to 800 for all text and titles, bold text and the map's IATA labels. Times and flight numbers stay Geist Mono; the wordmark stays Big Shoulders.
- Sora is about 10% wider than Geist at the same size, so it reads bigger. Sizes are unchanged; any line that now truncates or wraps badly gets fixed when spotted on a phone. CLAUDE.md updated.

## Round 201 (Nov 14): Departed and Arrived pills by Save, two colors, arrived tickets grayed

John: "Moved the departed and arrived pill next to the save button so it all aligns going top down and not dependent on the length of the departure and arrival times which seems like what it's doing. Different colors for departed and arrived. If it arrived the card should be greyed out as well."

- Results tickets: the pill moved off the times line to just left of Save, top right, so the pills form one column down the list. The times get the whole line.
- Colors: Departed keeps sky cyan; Arrived is graphite (light: #384250 on #dfe4eb; dark: #cbd3de on #29323e). Not violet (that's Delayed and Diverted), not green (early times and seats), not blue (tappable). Every Arrived pill uses it: tickets, the opened route's legs, Requests and the flight status sheet.
- Arrived tickets: the times, stops line and route line fade to 45%; the Arrived pill and Save stay full strength. Departed tickets keep the light gray they had. Before, arrived and departed both only got the very light gray card, which barely showed.
- CLAUDE.md rule updated.

## Round 202 (Nov 14): pills by the new times, gold At risk, codes-only area callout, Filters like Search

John, on round 201: "The pills should always align with the new departure and arrival time listed if it's delayed for example. Not the original time." "At Risk pill sits too high and can come down closer to the route line. Can we also make it a different color? Like yellow/gold?" "List only the airports at the top of the search... only put airport codes to shorten the callout because it's wrapping onto a second row." "The filters button should match the search pill container shape and size if possible on the flight summary page."

- On a results ticket whose times moved, the small struck schedule now sits above the whole top row. The new times, the Departed or Arrived pill and Save share one line under it, so the pill lines up with the new times. The opened route card keeps its layout.
- At risk and Missed get a gold of their own (`risk`, `riskBg`, `riskFg`), yellower than the amber that means "you" and the amber seat tier. The stop's ring turns gold too. On a 1-stop route the pill sits just over its stop's dot, beside the seat numbers; with 2 or more stops the stretches are short, so it keeps its room above the numbers.
- The area line over the tickets is now a plane (takeoff when leaving, landing when arriving) and each airport code in a small outlined chip, no city words, so it stays on one line beside the count pills. VoiceOver still reads the full sentence.
- Filters is now the same pill button as Search: same height, fully round, same tint and padding.
