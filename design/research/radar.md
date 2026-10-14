# Radar tile source: RainViewer vs NOAA MRMS (backlog item 10)

Research only. No code written, nothing signed up for, no paid calls. Checked 2026-10-14 against official pages, plus a few free, keyless test requests (a capabilities document and one image from each service, and one RainViewer tile header).

## The short version

- **Status: John chose NOAA (Q-031 option A, 2026-10-14).** Follow-up work is backlog items 13 and 14. Items marked "unverified" below are not confirmed; re-check before relying on them.
- **Recommendation: A, the NOAA route.** Use the National Weather Service's free MRMS radar mosaic service (`opengeo.ncep.noaa.gov`), not raw MRMS files.
- RainViewer's free API is now "personal and educational use only" and has been cut back (see below). That is fine for a friends beta but blocks a public release without a paid deal.
- NOAA data is public domain, needs no key, and the service can hand us a ready-made lat/lon image. That is exactly what a custom globe needs.
- Radar stays visual only. It never feeds badge logic.

## What each source is

| | RainViewer | NOAA MRMS via NWS GeoServer (WMS) | IEM NEXRAD composite (fallback) |
|---|---|---|---|
| Who runs it | RainViewer (company) | NOAA / National Weather Service | Iowa State University (IEM) |
| Key needed | No | No | No |
| License | "Personal and educational use only" (API page, FAQ) | Public domain. Capabilities file says Fees: none, AccessConstraints: none | Public domain; attribution requested, not required |
| Commercial / public release | Not allowed on free tier; paid plan or another source needed | Allowed. Do not imply NOAA endorsement, do not present altered data as official | Allowed for any lawful purpose; no SLA |
| Attribution | Credit "RainViewer API" with link to rainviewer.com; keep their watermark if shown | Request: credit NOAA/NWS for unaltered data. Our color-mapped image should say "Radar: NOAA/NWS MRMS" | "Iowa Environmental Mesonet" requested |
| Proxy / cache through our server | Not addressed in their terms; site terms ban redistribution of site content. Gray area | Allowed in practice (public domain). NWS asks: follow refresh schedule, request only what you need, back off on failure | Not stated; same good manners |
| Rate limits | 100 requests per IP per minute (since 2026-01-01). Our Edge Function shares IPs with other Supabase users | None found (unverified; no official limit located). NWS "may block IPs that strain systems" | None published |
| Coverage | Global, 1,200+ radars, 150+ countries. Covers HNL, ANC, SJU in principle (not checked per airport) | CONUS, Alaska, Hawaii, Caribbean (includes Puerto Rico), Guam. Separate layer per region | CONUS composite confirmed; Alaska/Hawaii/PR unverified |
| Update cadence | Frames every 10 min, past 2 h only | New frame about every 2 min, about 2 h of history in the service | Every 5 min |
| Forecast frames | Removed 2026-01-01 | None needed (we do not want forecast) | None |
| Frame timestamp | Yes, per frame (unix time) | Yes, list of timestamps in capabilities, default = latest | Not in a simple form; assume 5-min grid |
| Latency seen | Not measured | Latest frame was about 2 min old when I checked | Not measured |
| Projection | Web Mercator tiles (EPSG:3857), max zoom 7, 256 or 512 px | Server returns EPSG:4326 (lat/lon) or 3857 on request. I fetched a 4326 image | 4326 image worked |
| Single image or tiles | Tiles only | Single image for any box and size (WMS) | Single image, plus tiles |
| Colors | One scheme only ("Universal Blue") since 2026-01-01 | Standard reflectivity colors; transparent where no echo | Standard n0q colors |
| Cost | Free (personal use) | Free | Free |
| Sunset risk | Medium to high. Services cut in 2025 and again Jan 2026; "we do not guarantee availability" | Low to medium. Government service, no SLA on this host, but versioned change notices exist | Medium. One university team, no SLA |
| Expo Go | Fine (just images) | Fine | Fine |

Sources:
- RainViewer API: https://www.rainviewer.com/api.html and https://www.rainviewer.com/api/weather-maps-api.html
- RainViewer changes: https://rainviewer.com/api/transition-faq.html
- RainViewer site terms: https://www.rainviewer.com/terms.html
- NWS radar WMS list: https://opengeo.ncep.noaa.gov/geoserver/www/index.html
- NWS data policy: https://www.weather.gov/disclaimer
- NOAA MRMS on AWS: https://registry.opendata.aws/noaa-mrms-pds/
- IEM: https://mesonet.agron.iastate.edu/ogc/ and https://mesonet.agron.iastate.edu/disclaimer.php

## RainViewer: what is actually left (verified)

RainViewer's own FAQ lists these changes:
- 2025-08-01: processed images dropped; single-radar data cut to the last 6 images.
- 2025-09-01: composite images dropped for free users; closed beta ended.
- 2025-12-31: Weather Radar Database API ended.
- 2026-01-01: forecast (nowcast) and satellite IR removed; only one color scheme; max zoom 7; 100 requests per IP per minute.

What still works: the Weather Maps API (`api.rainviewer.com/public/weather-maps.json`, then tiles from `tilecache.rainviewer.com`). I called the index and one tile header today and both returned 200. Their page says "available for personal and educational use only" and also "we do not guarantee the availability of radar data." One aggregator site claims a free 5,000 requests per day developer plan; I could not confirm that on RainViewer's own pages, so I ignored it.

Note: no end date is announced, but the history shows they keep trimming the free tier, and the founder's blog points developers to paid alternatives.

## NOAA MRMS: three possible routes

1. **NWS GeoServer WMS (recommended).** `https://opengeo.ncep.noaa.gov/geoserver/<area>/<layer>/ows`. Layers per region: `conus_bref_qcd`, `alaska_bref_qcd`, `hawaii_bref_qcd`, `carib_bref_qcd` (bref = base reflectivity, quality controlled, 1 km). Test result: a 2048x1024 PNG of the whole CONUS box (lat 20 to 55, lon -130 to -60) came back in under 1 second, 355 KB, transparent where there is no rain. Region boxes from the capabilities files:
   - CONUS: lat 20 to 55, lon -130 to -60
   - Alaska: lat 50 to 72, lon -176 to -126
   - Hawaii: lat 15 to 26, lon -164 to -151
   - Caribbean: lat 10 to 25, lon -90 to -60 (covers SJU)
2. **Raw MRMS files on AWS (`noaa-mrms-pds`, no account needed).** Raw GRIB2 files, a new one about every 2 minutes. Decoding GRIB2 and reprojecting needs heavy code. A Supabase Free Edge Function has tight CPU and memory limits (UNVERIFIED, from memory: roughly 2 s CPU and 256 MB; confirm in Supabase docs before relying on it). Not realistic in Deno there. It would need a separate worker. Not recommended.
3. **IEM NEXRAD composite.** Works as a lat/lon image too (240 KB at 2048x1024 in my test). Good backup for the lower 48 only. Alaska/Hawaii/PR not verified.

nowCOAST (NOAA) looked like another option, but its help page returned 403 to my fetch, so I could not check its terms. Not pursued.

One gap: I could not find a published rate limit or SLA for the NWS GeoServer. NWS's general rule is to respect refresh times and request only what you need. Our cache design does that.

## How to draw it on the orthographic Skia globe

The globe is not a slippy map, so tiles are the wrong shape. A single lat/lon (equirectangular) image per region is ideal.

**Server (live-ops):**
1. One Edge Function (`live-radar`) asks each region's capabilities for the latest frame time (small XML, about 8 KB).
2. If that time is newer than what we cached, it fetches one image per region, uploads it to Supabase Storage, and writes a small JSON: region, image URL, lat/lon box, `observedAt`.
3. The app calls the function only; the function returns the JSON. Cache about 5 min (a config value, like the other live caches). Refresh lazily when the app asks and the cache is stale, so nothing runs when nobody is using the app.

**App (globe-porter), two ways to draw, pick one at build time:**
- **A. Skia mesh.** Build a grid of triangles per region (for example every 2 degrees), project each corner with the same d3 orthographic projection the globe already uses, and use the radar image as the texture (texture coordinates are just lon/lat scaled). Skip triangles on the far side. No shader code. Easier to keep in step with land and arcs.
- **B. RuntimeShader.** For each screen pixel inside the globe circle, undo the orthographic projection to get lat/lon, then look up the image. Smoother result, but more math and one pass per region.

Mesh (A) is my suggestion for a first version.

**Size and memory:**
- Request 1536 or 2048 px wide per region (about 22 to 29 px per degree). Estimated decoded size at 2048-wide CONUS is 8 MB; all four regions together roughly 14 MB at 2048, about 8 MB at 1536. Unverified: Alaska, Hawaii and Caribbean image sizes were not tested (only their boxes were read), so these totals are estimates.
- Network per refresh: about 0.4 to 0.6 MB total, and the app only re-downloads when `observedAt` changes.
- Requests per view: 1 (JSON) plus up to 4 images, only when the frame changed.

Because MRMS covers only US regions, the rest of the globe shows no radar. That fits the product (US airports plus HNL, ANC, SJU). RainViewer would add world coverage, but it is not needed here.

## Cost and Supabase Free limits

- NOAA: no fee. Supabase Free limits (UNVERIFIED, from memory, not checked against Supabase docs: 1 GB storage, 5 GB egress per month, 500k function calls; confirm on the Supabase pricing page): at about 0.6 MB per full fetch, 5 GB covers roughly 8,000 full downloads per month. A friends beta is far below that. Store only the latest frame per region (overwrite), so storage stays under about 2 MB.
- RainViewer: free, but 100 requests per IP per minute and tiles must be stitched or proxied, which is the gray area above.
- Paid cap ($30/mo): neither option uses AeroDataBox money.

## Reliability, age and fallback

- **Age:** Show "radar updated 3m ago" from the frame's own timestamp (`observedAt`), not the time we fetched it. No time slider, no radar key, per DECISIONS.
- **Stale behavior:** If NOAA fails, keep serving the last cached frame and keep showing its true age. If it is older than a limit (suggest 30 minutes, a config value), hide the overlay rather than show old rain. Never show "no rain" when we simply have no data.
- **Fallback chain (optional):** NWS GeoServer, then IEM for the lower 48.
- **RainViewer risk:** It has already cut free features three times (Aug 2025, Sep 2025, Jan 2026), so building on it means likely rework later.
- **Badges:** Radar never changes a badge. Badges stay METAR/TAF + FAA.

## Effort estimate

| | Edge Function (live-ops) | Globe overlay (globe-porter) | Notes |
|---|---|---|---|
| NOAA WMS | Small to medium (about 1 to 2 sessions): capabilities parse, 4 image fetches, storage, cache, tests with saved fixtures | Medium (about 1 to 2 sessions): mesh or shader, fade, toggle, age label | Recommended |
| RainViewer | Medium: index fetch, up to 16 or more tiles per frame, stitching or per-tile proxy, rate-limit handling | Medium to large: Web Mercator to globe, tile seams | Terms block public release |
| Raw MRMS GRIB2 | Large; likely needs infrastructure outside Edge Functions | Same as NOAA | Not recommended |

## Public release note

If this ever leaves the friends beta: NOAA and IEM are fine for a public or paid app (keep the attribution and do not claim NOAA endorsement). RainViewer's free tier is not; it would need a paid plan.

## Proposed question for John (for design/QUESTIONS.md)

Filed and answered as Q-031 in `design/QUESTIONS.md` (2026-10-14): John chose NOAA MRMS (option A). The text below is the original draft.

### Q-031 Radar source (draft)
Context: Radar is P1 polish and visual only. RainViewer's free API is personal/educational only and has been cut back three times (latest 2026-01-01). NOAA's free MRMS radar service is public domain, keyless, includes HI, AK and PR, and gives us a ready lat/lon image.
A) NOAA MRMS via the NWS radar service (recommended)  B) RainViewer  C) Defer radar
Recommendation: A. Free, no key, safe for a later public release, and the simplest to draw on the globe.

## Follow-up items (approved; now backlog 13 and 14)

1. **live-ops: `live-radar` Edge Function.** Parse capabilities for latest time per region, fetch one image per region, store latest frame in Supabase Storage, return JSON with `observedAt`, region boxes and image URLs. Config: cache minutes, max age, image width. Tests use saved fixtures. Log requests per call. Add attribution string to the response.
2. **globe-porter: radar overlay.** Draw the region images on the orthographic globe (mesh first), behind arcs and badges, semi-transparent, with a layer toggle. No time slider, no color key. Show "radar updated Xm ago". Hide when older than the max age.
3. **Optional later: IEM fallback** inside the same function.

John approved adding items 13 and 14 (2026-10-14).
