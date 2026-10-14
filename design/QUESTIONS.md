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

### Q-012 Nearby airports list and ground-transfer minutes  (Open)
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
Answer: John (2026-10-14). Free plan, US East region for the beta. Upgrade to Pro ($25/mo) before testers rely on it, since free projects pause after a week idle.

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
- Search date = local calendar date at the origin, 0 to 7 days out; departed flights excluded.
