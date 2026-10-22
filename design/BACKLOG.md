# Backlog (top = next)

Each item names its owner. One item per work session. spec-keeper runs a pre-flight check first; qa-runner and design-critic review after. "main" = the main Claude Code session (no specialist agent).

| # | Item | Owner | Priority | Status |
|---|---|---|---|---|
| 0 | Project foundation: clear the Expo template's example screens; add `typecheck` and `test` (jest-expo) scripts; folders `src/engine`, `src/map`, `src/live`, `src/theme`; Ice Mix theme tokens (light/dark) and fonts | main | P0 | Done |
| 1 | Itinerary engine from DECISIONS.md "Search": 0–3 stops, connection rules, nearby airports, earliest-arrival sort, sample flight data behind a `FlightDataProvider` interface; full unit tests | main | P0 | Done |
| 2 | `src/map/` with the `GlobeMap` interface + Globe v1: orthographic Skia globe, land/ocean, state lines, cached static layer | globe-porter | P0 | Done |
| 3 | FAA NAS status Edge Function + cache + `useAirportStatus` hook (fixtures in tests) | live-ops | P0 | Done (deployed 2026-10-14) |
| 4 | Arcs with tier colors and line styles, tap to select (28pt), camera fly-to, top 10 routes | globe-porter | P0 | Done |
| 5 | METAR/TAF Edge Function + disruption classifier (Caution / Likely delays) | live-ops | P0 | Done (deployed 2026-10-14) |
| 6 | Search + results screens wired to the engine and globe; each result row shows the seat tier and reserves a slot for delay/weather badges (Q-001), filled in item 7 | main | P0 | Done |
| 7 | Delay and weather badges on every results row and airports on the globe | live-ops → globe-porter | P0 | Done |
| 8 | Flight status for opened flights (AeroDataBox) with unit logging toward the spend cap | live-ops | P0 | Built (fixtures); deploy pending AeroDataBox key |
| 9 | Map marks: home house pin, origin dot, destination rings, label flipping, chevrons | globe-porter | P0 | Done |
| 10 | Radar tile source (RainViewer vs NOAA MRMS; confirm terms) | live-ops | P1 | Done (research; Q-031: NOAA) |
| 11 | Globe polish: day/night, spin-in, flight preview | globe-porter | P1 | Done |
| 12 | Leave-by card + tester settings screen (airport buffer, default 75 min; Q-003) | main | P0 | Done |
| 13 | `live-radar` Edge Function: latest NOAA MRMS frame per region (CONUS, AK, HI, Caribbean) as a cached lat/lon PNG with observedAt; polite fetching, stale fallback | live-ops | P1 | Done (deployed 2026-10-14) |
| 14 | Radar overlay on the globe (Skia mesh/shader from lat/lon image), on/off toggle, age shown, hidden past 30 min; no time slider or color key | globe-porter | P1 | Done |
| 15 | Leg flight-time labels on the selected route (H:MM, subtle, on the line) | globe-porter | P1 | Open |
| 16 | Bottom tab bar: Search · Feed · My Trips · Profile (replaces top-bar Requests pill); Feed/My Trips screens as placeholders until requests backend exists | main | P1 | Open |
