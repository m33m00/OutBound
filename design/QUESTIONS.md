# Questions for John

Agents add questions here; John answers inline (or in a GitHub issue later). spec-keeper moves answers into DECISIONS.md.

### Q-001 Headline feature  (Answered 2026-10-13)
Context: Real-time status, FAA delays and weather moved into the MVP on 2026-10-13. The build order depends on what leads.
A) Seat availability stays the headline; live data supports it
B) Equal: both shown on every result
C) Routing + live status/weather lead; seat availability is secondary
Recommendation: B. Live data is free or already paid for, and both fit on a result row.
Answer: B (2026-10-13). Equal: seat availability and live data (status, FAA delays, weather) both shown on every result row.

### Q-002 Remove react-native-maps?  (Answered 2026-10-13)
Answer: Moot. Starting a fresh project on the Mac; the old test code isn't used.

### Q-003 Airport buffer for the leave-by card  (Answered 2026-10-13)
Context: Default is "be at the airport 75 min before departure".
A) Keep 75 min  B) 60 min  C) Tester setting with 75 default
Recommendation: C.
Answer: C (2026-10-13). Tester setting, default 75 min.

### Q-004 Theme tokens beyond accent and amber  (Answered 2026-10-13)
Context: DECISIONS.md confirms only accent (#1D3D84/#9BB8EF) and amber you-text (#9A5200/#FFC27A). Backlog 0 proceeded with provisional values copied from the Ice Mix look in the v9.1 prototype (surfaces, text, tier, weather violet #5b4bd6/#b7adff, magenta #a3269a/#f283e8, type scale) in src/theme/, marked provisional. Non-blocking.
A) Confirm prototype values as-is  B) Keep provisional; John reviews on device first  C) John supplies values
Recommendation: A, after John sees it on his phone.
Answer: A (2026-10-13). Prototype values confirmed as-is; John may still revise after seeing it on his phone. Non-blocking; no backlog items were waiting on it.

### Q-005 Font weights  (Answered 2026-10-13)
Context: Using the prototype's loaded weights: Big Shoulders Display 600/700/800, Manrope 400/500/600/700. Non-blocking.
A) Confirm  B) Other weights
Recommendation: A.
Answer: A (2026-10-13). Confirmed.

### Q-006 Light-theme "faint" text contrast fix  (Answered 2026-10-13)
Context: Prototype light faint text #66758a is 4.17:1 on surface2 and 4.41:1 on bg, failing the >=4.5:1 rule. Implemented as #606f84 (4.55 / 4.81). Non-blocking.
A) Accept #606f84  B) Keep #66758a but never use faint on surface2/bg
Recommendation: A.
Answer: A (2026-10-13). Light faint text = #606f84.

### Q-007 Space color behind the globe  (Open)
Context: Backlog 2 (globe v1). As built, the space behind the globe is the app background token `bg` (#f6f8fb light / #0b1119 dark). The prototype used its own space color (#e9eef4 light / #05080e dark). Non-blocking.
A) Keep `bg` token (as built)  B) Use prototype space color (#e9eef4 / #05080e)
Recommendation: A, so the globe blends with the rest of the app; revisit after seeing it on device.
Answer: (John)

### Q-008 Prototype grid, lakes, timezone lines, stars  (Open)
Context: Backlog 2 omitted the prototype's faint lat/long grid, lakes, timezone lines and stars. As built: all out. Non-blocking.
A) Leave all out for good  B) Bring back grid and lakes in a later item; timezone lines and stars stay out  C) Bring all back later
Recommendation: A for now; add a backlog item only if the globe feels bare on device.
Answer: (John)

### Q-009 Default globe view before search  (Open)
Context: With no camera target from search, the globe shows the continental US centered at [-97, 38], zoom 1, globe centered (as built). The prototype framed center latitude 20 with the globe pushed low. Non-blocking.
A) Keep as built  B) Prototype framing (lat 20, globe pushed low)  C) Other (John specifies)
Recommendation: A, until the search/result layout shows how much screen the globe gets.
Answer: (John)

### Q-010 Geography data sources  (Open)
Context: For the record, backlog 2 uses Natural Earth (public domain) via the world-atlas package (ISC license) for land and borders, and US Census cartographic boundaries (public domain) via us-atlas (ISC) for state lines. Non-blocking.
A) Confirm  B) Use different sources (John specifies)
Recommendation: A. All are free to use with no attribution required.
Answer: (John)

### Q-011 Globe color values  (Open, pending confirmation)
Context: Not yet decided. Globe colors as built (light / dark), taken from the prototype or chosen by globe-porter. Confirm after seeing on device:
- Ocean highlight #d5e3ee / #1d4266
- Ocean edge #aac0d3 / #0b1a2c
- Land #f4f5ef / #4a767c
- Coast and borders #c4cdc3 / #2a4a50
- Atmosphere rgb(120,170,230) / rgb(90,160,255)
- Limb darkening rgba(40,60,90,.18) / rgba(0,0,0,.45)
- State lines: theme text color at 40%
A) Confirm all as built  B) Keep provisional until John reviews on device  C) John supplies changes
Recommendation: B, then A or C after seeing it on the phone.
Answer: (John)

### Q-012 Nearby airports list and ground-transfer minutes  (Open; candidate-metro list superseded 2026-10-21 by Q-048; transfer minutes now see Q-052)
Context: Backlog 1 (itinerary engine). As built: only the confirmed DAL<->DFW group is active, with a provisional 35 min ground transfer. Nearby airports apply at the origin and destination ends only, never mid-route. Each result records requested airport, used airport and ground transfer minutes. Non-blocking.
A) Activate these candidate metros: NYC (JFK/LGA/EWR), Chicago (ORD/MDW), LA (LAX/BUR/SNA/LGB/ONT), Washington (DCA/IAD/BWI). John also gives transfer minutes per group (or approves defaults I propose).
B) John supplies his own list and transfer minutes per group.
C) Keep DAL<->DFW only for now.
Recommendation: A, with John editing the transfer minutes; nearby is useful for standby travelers in big metros.
Answer: (John)

### Q-013 "Best availability" tie-break and extra sorts  (Open)
Context: Backlog 1. As built: ties are broken by route tier, meaning the weakest reported/estimate leg, ranked wide > good > okay > tight > full > unknown. The optional "Most seats" and "Best bet" sorts are not built. Non-blocking.
A) Keep the tie-break as built; no extra sorts
B) Keep tie-break; add Most seats and Best bet sorts later (John defines "Best bet")
C) Different tie-break (John specifies)
Recommendation: A for now; revisit after seeing real results on device.
Answer: (John)

### Q-014 Typical-load legs and route tier  (Open)
Context: Backlog 1. As built: legs with only typical-load data map to tier 'unknown' with source 'typical'. They are neutral: ignored for route color and for availability ranking. Non-blocking.
A) Keep as built  B) Count typical loads as a weak signal in ranking and color (John specifies weight)
Recommendation: A; typical data is not live, so it should not drive color.
Answer: (John)

### Q-015 FAA status to badge mapping  (Answered 2026-10-14)
Context: Backlog 3 (FAA NAS status) needs a rule for which FAA events show which badge.
Answer: John (2026-10-14). Ground stop, ground delay program or airport closure = Likely delays (magenta). General arrival/departure delay under 60 min = Caution (violet). No FAA event = no badge. General delay of 60+ min was not stated; provisional default is Likely delays (not John-decided). Unblocks backlog 3.

### Q-016 Supabase plan and region  (Answered 2026-10-14)
Answer: John (2026-10-14). Free plan, ~~US East region for the beta~~ (US East part superseded 2026-10-21 by Q-038: stay on us-west-2). Upgrade to Pro ($25/mo) before testers rely on it, since free projects pause after a week idle.

### Q-017 Edge Function access before login exists  (Answered 2026-10-14)
Answer: John (2026-10-14). Until invite-code login exists, live Edge Functions accept calls with the app's public anon key, with rate limiting. Require login once auth lands. Unblocks backlog 3.

### Q-018 Deselecting a route on the globe  (Answered 2026-10-14)
Answer: John (2026-10-14). Tapping empty space while a route is selected deselects it (back to the all-gray overview) and pulls the camera back out.

### Q-019 FAA general delay of 60+ minutes  (Answered 2026-10-14)
Context: Q-015 did not say what a general arrival/departure delay of 60+ min shows.
Answer: John (2026-10-14). 60+ min = Likely delays. Under 60 min stays Caution. Replaces the provisional default.

### Q-020 FAA airport closures with future dates  (Answered 2026-10-14)
Context: The FAA feed gives closure Start/Reopen without a year, so future-dated closures cannot be reliably told apart.
Answer: John (2026-10-14). Any closure the FAA lists shows Likely delays; no attempt to filter future-dated ones. Early badges are acceptable.

### Q-021 Solid/dashed on gray overview and ghost lines  (Answered 2026-10-14)
Context: Backlog 4. "Solid = reported; dashed = estimate/typical/unknown" and "Legend only while a route is selected." As built (like the v9.1 prototype), only the selected route uses solid/dashed; the gray overview lines and faint ghosts are always solid. Non-blocking.
A) Keep as built: solid/dashed only on the selected route  B) Also dash non-reported legs in the gray overview and ghosts
Recommendation: A; with no legend shown in the overview, dashes there are unexplained noise, and thin gray dashes are hard to read.
Answer: John (2026-10-14), option A. Overview and ghost lines are always solid thin gray; solid/dashed applies only to the selected route.

### Q-022 Meaning of the 28pt line hit area  (Answered 2026-10-14)
Context: Backlog 4. "Map line hit area 28pt." As built (like the v9.1 prototype), a tap counts if it lands within 28pt of the line on either side (a 56pt-wide band). The other reading is a 28pt-wide band (14pt each side). Non-blocking; one constant.
A) Keep as built: within 28pt of the line  B) 28pt-wide band (14pt each side)
Recommendation: A; arcs are thin and overlap, and the selected route is preferred when in range, so the larger area is forgiving without stealing taps.
Answer: John (2026-10-14), option A. May be tightened after on-device testing.

### Q-023 Leave-by travel time  (Answered 2026-10-14)
Context: Backlog 12. How the Leave-by card knows when to leave.
A) Drive-time setting  B) "Be at" only card  C) Phone location
Answer: John (2026-10-14), option C, phone location. Details follow the v9.1 prototype and are provisional: location asked only on "Use Location" tap (card) or "Use my location" toggle (settings), never at launch; fresh for 20 min; within 400 km drive = round((km x 1.3 / 55 x 60 + 10) / 5) x 5 min; within 3 km = "You're at {AP}"; no fresh location or out of range = "Be at {AP} by {time}" with "{buffer} min before departure to list and clear security"; late on the day = "Leave now". Card is for the selected route's first leg, times in the departure airport's local time.

### Q-024 Settings scope  (Answered 2026-10-14)
Context: Backlog 12. What the settings screen holds.
Answer: John (2026-10-14). Airport buffer (default 75, range 30-180, step 5; range provisional), "Use my location", and search defaults (max stops, same-airline and switching connection minimums, longest layover, nearby airports, longest ground transfer). Filters panel starts from saved defaults. Reached from the Profile button.

### Q-025 Settings persistence  (Answered 2026-10-14)
Context: Backlog 12. Where settings are stored before login exists.
Answer: John (2026-10-14). Saved on the phone (AsyncStorage) now; move to the account when login exists.

### Q-026 Home airports  (Answered 2026-10-14)
Context: Backlog 9 (map marks) and search. How the app knows where "home" is.
Answer: John (2026-10-14), option B: one main home plus optional extra homes, set in Settings (Profile). Nearby-group airports of the main home are added automatically. See DECISIONS.md (Home airports). Provisional defaults listed there.

### Q-027 Weather badge thresholds  (Answered 2026-10-14)
Context: Backlog 5 (METAR/TAF). What METAR/TAF conditions map to Caution vs Likely delays.
A) Ceilings + storms + wind + winter (recommended): the thresholds in the Answer line below.  B) Ceilings + storms only: Caution = IFR or storms nearby; Likely delays = LIFR, heavy storms, freezing rain or heavy snow; wind ignored.  C) John gives his own thresholds.
Recommendation: A.
Answer: John (2026-10-14), option A. Caution = IFR (ceiling 500 to <1,000 ft or vis 1 to <3 mi), VCTS, gust >=30 kt or sustained wind >=25 kt, any snow/ice pellets or freezing precip (light), fog with vis <2 mi. Likely delays = LIFR (ceiling <500 ft or vis <1 mi), thunderstorm at the airport, gust >=40 kt, moderate/heavy snow, any freezing rain/ice, vis <1/2 mi. VFR/MVFR alone never shows a badge. All thresholds in one config file, tunable after testing. Unblocks backlog 5 (not edited here).

### Q-028 Weather beyond the TAF window  (Answered 2026-10-14)
Context: Backlog 5. TAFs cover about 24-30 h; flights further out have no METAR/TAF forecast.
A) No weather badge beyond the forecast window (recommended; NWS can be its own item later).  B) Add NWS forecast now for days 2-7 with simpler rules (storms, snow, ice only).
Recommendation: A, because it keeps item 5 small.
Answer: John (2026-10-14), option A. NWS longer-range forecast can be its own later item.

### Q-029 Weather edge cases left open by Q-027  (Answered 2026-10-14)
Context: Q-027 did not settle freezing drizzle, ice pellets, blowing snow, sustained high wind or airports without an ICAO mapping. Main session recommended defaults; John adopted them all.
Answer: John (2026-10-14), adopted the recommendations. Freezing rain any intensity = Likely delays; light freezing drizzle = Caution, moderate/heavy = Likely delays. Ice pellets light = Caution, moderate/heavy = Likely delays (changes build). Blowing snow = Caution (visibility rules can raise it). Sustained wind >=40 kt without gusts = Likely delays (changes build). No ICAO mapping (non-US other than HNL/ANC/SJU) = no weather badge for now. Follow-up for live-ops: update the weather classifier and config for ice pellets and sustained wind. Does not block backlog 7.

### Q-030 Partial FAA airport closures  (Answered 2026-10-14)
Context: The live FAA feed listed LAX "AD AP CLSD TO NON SKED TRANSIENT GA ACFT ... until May 2027". Under Q-020 that would show Likely delays at LAX for months.
A) Only full closures show Likely delays (recommended)  B) Partial closures = Caution  C) Keep as is (Q-020)
Recommendation: A.
Answer: John (2026-10-14), option A. FAA closures show Likely delays only when the whole airport is closed. Closures limited to private/GA, non-scheduled, or by-permission (PPR) flights, and runway/taxiway-only closures, are ignored. Ground stops, ground delay programs and general delays unchanged. Supersedes the closure part of Q-020.

### Q-031 Radar source  (Answered 2026-10-14)
Context: Backlog 10 research (design/research/radar.md). Radar is P1 polish and visual only.
A) NOAA MRMS via the NWS GeoServer WMS (opengeo.ncep.noaa.gov): free, public domain, keyless, ~2-min frames, CONUS/Alaska/Hawaii/Caribbean/Guam, ready-made lat/lon images (recommended)  B) RainViewer: free tier personal/educational only, cut three times since Aug 2025, Web Mercator tiles, paid for public release  C) Defer radar
Recommendation: A, because it is free, safe for a later public release and the simplest to draw on the globe.
Answer: John (2026-10-14), option A (NOAA). Unblocks new backlog items 13 and 14. Provisional defaults (not John-decided): polite to NWS (respect refresh, request only needed regions, back off on failure); stale rule = show last frame with its age, hide overlay older than 30 min (config); radar never feeds badge logic; no time slider, no color key; on/off toggle.

### Q-032 Radar default and persistence  (Answered 2026-10-14)
Context: Radar overlay (backlog 14) needs a default state and whether the on/off choice sticks.
A) On, remembered (recommended)  B) Off by default, remembered  C) On, not remembered
Recommendation: A.
Answer: John (2026-10-14), option A. Recorded in DECISIONS.md (Map). Unblocks backlog 14 (radar overlay) on this point; the setting is stored with the other settings (Q-025). Main-session provisional defaults (not John-decided) are listed in DECISIONS.md.

### Q-033 Radar colors vs. amber/magenta marks  (Answered 2026-10-14)
Context: NOAA radar uses orange/red/magenta, which could be confused with amber ("you") and magenta (Likely delays) UI marks.
A) Standard NOAA colors, marks always draw above radar (recommended)  B) Recolor radar to a palette with no amber/magenta  C) Single blue scale
Recommendation: A, because it is the familiar weather look and marks stay distinct by layering.
Answer: John (2026-10-14), option A. Recorded in DECISIONS.md (Map, radar; also noted by "Amber = you only"). Provisional opacity and caption recorded there as not John-decided.

### Q-034 Flight preview content  (Answered 2026-10-14)
Context: Backlog 11 globe polish. What the flight preview shows.
A) Plane only (recommended)  B) Plane + moving night  C) Skip
Recommendation: A.
Answer: John (2026-10-14), option B: a plane flies the selected route and day/night shifts to the flight's scheduled times. This partly brings back a moving sky clock; the user-controlled time slider stays removed. Recorded in DECISIONS.md (Map).

### Q-035 Flight preview trigger  (Answered 2026-10-14)
Context: How the preview starts.
A) Button only (recommended)  B) Auto once + button  C) Auto every time
Recommendation: A.
Answer: John (2026-10-14), option A. Recorded in DECISIONS.md (Map).

### Q-036 Spin-in intro  (Answered 2026-10-14)
Context: How often the globe spin-in plays.
A) Every app launch (recommended)  B) First launch only  C) Once per day
Recommendation: A.
Answer: John (2026-10-14), option A. Skipped under Reduce Motion; any touch stops it. Recorded in DECISIONS.md (Map).

### Q-037 Day/night look  (Answered 2026-10-14)
Context: How day/night is drawn on the globe.
A) Shading + soft dusk + subtle sun glow (recommended)  B) Also sun disc + labels  C) Shading only
Recommendation: A.
Answer: John (2026-10-14), option A. Recorded in DECISIONS.md (Map). Provisional details there are not John-decided.

### Q-038 Supabase region  (Answered 2026-10-21)
Context: Q-016 chose US East, but the project was created in us-west-2. api_usage (backlog 8) will be the first real DB data, so moving later gets harder.
A) Keep us-west-2  B) Recreate in US East before any data lands
Recommendation: A, because friends beta, latency difference is small.
Answer: John (2026-10-21), option A, keep us-west-2. John asked about US Central; Supabase has no US Central region (closest is us-east-2 Ohio), so he went with the recommendation. Supersedes the US East part of Q-016. Recorded in DECISIONS.md (Tech). Unblocks backlog 8 (api_usage can land in us-west-2).

### Q-039 Canceled/diverted flight status and badges  (Answered 2026-10-21)
Context: Backlog 8 shows flight status as text in a flight sheet. Should any of it change the row badge?
A) Text only in the flight sheet, no row badge  B) Canceled = Likely delays badge on the row  C) B plus delays of 60+ min from flight status also badge
Recommendation: A for now; revisit after seeing real data.
Answer: John (2026-10-21), option A. Canceled/diverted status is text only in the flight sheet, no row badge. Recorded in DECISIONS.md (Real-time layer). Unblocks the UI part of backlog 8.

### Q-040 AeroDataBox plan  (Answered 2026-10-21)
Context: The api_usage unit-price placeholder needs a real plan/marketplace price to make the $30 cap meaningful.
A) Lowest paid tier on API.market/RapidAPI  B) Free tier only for now
Recommendation: A, because the free tier is unlikely to cover daily schedule pulls plus live status.
Answer: John (2026-10-21), option A. Lowest paid AeroDataBox tier on API.market/RapidAPI. Unit price stays a placeholder until the exact price is read from the plan page at signup. Recorded in DECISIONS.md (Real-time layer).

### Q-041 Leg flight-time labels on the globe  (Answered 2026-10-21)
Context: Friend-tester feedback: hard to tell how long each leg is. Should the globe show leg durations, and where?
A) Small label on each leg of the selected route only  B) Labels on all route lines  C) Skip
Format options: "2:35" / "02:35" / "2h 35m"
Recommendation: A, format "2:35"; keeps the overview clean.
Answer: John (2026-10-21), option A (selected route only) and "2:35" (H:MM, no leading zero on hours). Duration = arriveUtc - departUtc. Recorded in DECISIONS.md (Map). Unblocks new backlog item 15.

### Q-042 Bottom tab bar  (Answered 2026-10-21)
Context: Friend-tester feedback on navigation. DECISIONS.md said "No tabs; top bar = wordmark, Requests pill, Profile."
A) Keep top bar only  B) Four bottom tabs: Search, Feed, My Trips, Profile
Recommendation: B.
Answer: John (2026-10-21), four tabs: Search, Feed, My Trips, Profile. Feed = request feed (your airline's asks, per existing Requests rules). My Trips = your own open requests (max 5) plus saved routes. Supersedes "No tabs" (Design system). "Saved routes" is new with no rules yet; details open/provisional (see Q-043). Unblocks new backlog item 16.

### Q-043 Saved routes details  (Open)
Context: Q-042 puts "saved routes" in My Trips, but there are no rules for it. Non-blocking: item 16 ships placeholders.
A) Save from a result row or the selected route; stored on the phone (AsyncStorage) for now, no cap  B) Same, but cap at 10  C) John specifies
Also open: does a saved route keep its date, or re-search when opened?
Recommendation: A, re-search for the saved date when opened; add a cap only if the list gets unwieldy.
Answer: (John)

### Q-044 Combined route legend  (Answered 2026-10-21)
Context: Friend-tester feedback: the tier color key and the solid/dashed key are two lists.
A) One combined list, rows like "Good (Estimate)" / "Good (Reported)", swatch in the row's line style  B) Keep two lists
Answer: John (2026-10-21), option A. Line style rules unchanged. Recorded in DECISIONS.md (Map). Unblocks backlog 18.

### Q-045 Date row chips and calendar  (Answered 2026-10-21)
Context: Friend-tester feedback: the date row is crowded (0-7 days out).
A) 4 chips (Today, Tomorrow, next two days) plus a calendar button for later dates  B) Keep all chips
Answer: John (2026-10-21), option A. 0-7 days limit unchanged. Recorded in DECISIONS.md (Search). Unblocks backlog 19.

### Q-046 Filters button icon  (Answered 2026-10-21)
Context: Friend-tester feedback: the Filters button's purpose is not clear at a glance.
A) Add an SF Symbol icon like the tab bar  B) Leave as is
Answer: John (2026-10-21), option A. Recorded in DECISIONS.md (Design system). Unblocks backlog 20.

### Q-047 No-results panel and departed/status display  (Answered 2026-10-21)
Context: John does not want a second panel when there are no flights. Wants a discreet notice only if the market truly has no flights that day; otherwise show flights including ones that may have departed, marked scheduled / departed / canceled / delayed. Conflicts: DECISIONS.md fetches AeroDataBox flight status only for flights a user opens or travels on ($30/mo cap), and the engine drops departed flights (Search date rule). Main session is asking John.
A) Show departed flights from the schedule DB with a time-based "may have departed" label; status words (delayed/canceled) only when a flight is opened  B) Also fetch live status for all listed flights (breaks the opened-flights-only rule; cost risk)  C) Other (John specifies)
Recommendation: A, because it needs no extra paid calls.
Answer: John (2026-10-21), option B and more (live status on every row). (1) No flights in the market that day: banner "No Flights Found on Selected Date", dismissible with X, no results panel. (2) Flights exist but filters hide all: banner like "3 routes hidden by your filters · Show Them", dismissible with X. (3) Departed flights shown, mixed in by time (supersedes the engine dropping departed flights). (4) Live status on every result row, each flight fetched once into the shared server cache (supersedes "status only for opened flights" and Q-039 option A). Cost/cap: see Q-049. Tags: see Q-050. Unblocks backlog 21.

### Q-048 Airport areas (metro groupings)  (Answered 2026-10-21)
Context: Typing "DAL" should offer all Dallas airports or Love Field alone. Relates to the Nearby airports filter (NEARBY_GROUPS).
A) Metro "area" entries in the picker built from NEARBY_GROUPS  B) Separate metro list  C) Other (John specifies)
Recommendation: A.
Answer: John (2026-10-21), option C: an Area toggle on the From and To cards instead of picker entries. (8) Toggle top-right of each card, only when the airport belongs to an area. Off: outline gray pill "+ Area". On: solid accent-blue pill "All Dallas"; card lists every airport in the area in small wrapping text (e.g. LAX · BUR · LGB · SNA · ONT). (9) Areas = IATA metropolitan city groupings as major airlines use, limited to cities with 2+ airports in the app's data. (10) "Nearby airports" filter removed (supersedes the "Nearby airports on" default). (11) Default off, then remembered per airport. (12) Picker shows airports only, no area rows. (13) Get Home always searches all airports in the home's area. Unblocks backlog 22. Partly supersedes Q-012 option A (candidate metros).

### Q-049 App spend cap for AeroDataBox  (Answered 2026-10-21)
Context: Live status on every row (Q-047) raises call volume against the $30 cap / $24 alert / pause-at-cap rules.
A) Keep the cap  B) No cap for now, keep usage logging  C) Raise the cap
Recommendation: B only if the plan itself bounds spend.
Answer: John (2026-10-21), option B: NO app spend cap for now ("we will address this later"). Supersedes the $30 cap, $24 alert and pause-at-cap rules; `api_usage` logging stays. Fact: AeroDataBox flat plans below Mega have no overage, so the subscribed plan bounds spend. Cost estimates (unit cost per call unverified): shared cache with live status only within 6h of departure about $7.50-15/mo for 5-50 users; every row shared about $15-37.50/mo. Notes in `design/research/flight-status-cost.md`.

### Q-050 Row status tags  (Answered 2026-10-21)
Context: How flight status looks on result rows (Q-047).
Answer: John (2026-10-21). (5) Scheduled = no tag. "Delayed 25m" violet (existing Caution color) with old time struck through. Departed = gray tag, row dimmed. Canceled = red (existing most-severe delay color), time struck through. Amber stays "you" only. (6) Routes with a canceled leg stay in their normal time position. (7) A delay that breaks a connection shows a "Connection at risk" tag at the connecting airport.

### Q-051 Default origin from location  (Answered 2026-10-21)
Context: Search From currently starts at the main home; location is only requested on "Use Location" tap.
Answer: John (2026-10-21). (14) Default origin = nearest airport to the user, however far. First launch shows the app's own card "Start searches from the airport nearest you?" Allow / Not Now; iOS prompt only after Allow; Not Now = never asked at launch again, can enable in Profile. Origin refreshes on app open if location is older than 20 min; never overwrites an airport the user picked while the app is open. (15) Location off: main home, else last searched origin, else empty with the existing hint. Supersedes "location requested only on Use Location tap ... never at launch" (Q-023 provisional). Unblocks backlog 23.

### Q-052 Fate of "Longest ground transfer" setting  (Answered 2026-10-21)
Context: With the Nearby airports filter removed (Q-048), the "Longest ground transfer" stepper (default 60, Settings and Filters) only mattered when nearby was on. Area toggle includes every airport in the area, so the limit may be moot. Non-blocking: backlog 22 can leave the stepper hidden.
A) Remove it  B) Keep it, applied to area airports  C) John specifies
Recommendation: A, because the toggle already says "all airports".
Answer: John (2026-10-21), option A. Remove the setting from Filters and Settings; per-area transfer minutes stay as internal data.

### Q-053 Canceled tag color  (Open)
Context: Q-050 said Canceled is "red, the existing most-severe delay color", but the most-severe delay color is magenta (Likely delays) and the only red in the app is the Full seat tier. The main session's earlier summary to John misstated the existing color. Backlog 21 shipped provisionally with a dedicated red.
A) Magenta (likelyDelays token)
B) Full-tier red (#d8474a / #ff6b6b family)
C) Dedicated red token, as built: light #c8102e text-mark / #fde0e3 bg / #9e0d24 text; dark #ff4d5e / #3a1018 / #ffa3ad; plus xmark.circle icon
Recommendation: C, because red reads as canceled at a glance, stays distinct from the Full seat tier and from magenta weather/FAA badges, and the icon keeps it from relying on color alone.
Answer: (John)

### Q-054 Schedule pulls: how often, and which airports  (Open)
Context: Backlog 25 builds the schedule DB ("own schedule DB from daily AeroDataBox pulls (~30 airports)"). It is built and tested with hand-written samples; nothing calls AeroDataBox until the key is added and the daily job is switched on. Each airport-day costs 2 FIDS calls (AeroDataBox caps a call at 12 hours). Provisional build: the 12 airports already in the app's table; a daily run pulls today, tomorrow and day 7 (12 x 3 x 2 = 72 calls a day, about 2,200 a month); a one-time fill of days 0-7 is 192 calls. Units per call and the unit price are placeholders until the plan page is read at signup, so the monthly cost is not known yet. Flights to airports outside the table are dropped, because the app can't draw or search them.
A) Keep as built: 12 airports, daily pull of days 0, 1 and 7
B) Pull every day 0-7 daily (fresher, about 2.7x the calls)
C) Grow to ~30 airports now (needs the extra airports' coordinates and time zones added to the app; about 2.5x the calls)
Recommendation: A for the friends beta, then C once real usage shows in `api_usage` and the plan's price is known.
Also open: real flights have no seat data yet (no reports or estimates exist), so every route shows Unknown until reports land. Sample seats are not mixed in, because they would be made up.
Answer: (John)

Provisional defaults for backlog 3 (not John-decided; John may override any time):
- FAA cache TTL 5 min server-side; serve stale on FAA error.
- One national NAS feed fetch, filtered on read.
- Every value carries an as-of timestamp.
- Chevrons: item 9 (item 4 ships arcs without chevrons).

Provisional engine defaults (Backlog 1, as built, not yet decisions; John may override any time):
- Max total trip 24h.
- Connections must be at the same airport.
- No airport repeated in an itinerary.
- Intermediate stops cannot be an origin or destination group airport.
- Search date = local calendar date at the origin, 0 to 7 days out; ~~departed flights excluded~~ (superseded 2026-10-21 by Q-047: departed flights shown).
