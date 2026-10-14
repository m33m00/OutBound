# live-radar

Latest NOAA/NWS MRMS base-reflectivity frame per region, as a lat/lon PNG. Source (Q-031): NWS GeoServer WMS
`https://opengeo.ncep.noaa.gov/geoserver/<workspace>/<layer>/ows` (public domain, no key). Radar is visual only; it never feeds badges.

## Design (provisional, not John-decided)
- **Pure pass-through.** The function relays NOAA's PNG bytes and never decodes or re-encodes them (Free plan: 2 s CPU, 256 MB, verified in `design/research/radar.md`). No Supabase Storage.
- **Frame time first.** The JSON route reads only the small WMS GetCapabilities (about 8 KB) and reports `observedAt` (the time dimension's default = latest frame). No image is fetched until the app asks for it.
- **Image route** fetches one GetMap with `time=<observedAt>` pinned (so picture and timestamp always match), keeps the newest frame per region in memory, and fetches again only when `t` is newer than the held frame.
- **Polite:** capabilities read at most every 2 min per region; one in-flight fetch per region and per frame (no stampede); exponential backoff after failures (30 s, 60 s ... cap 10 min); only requested regions; descriptive User-Agent; 8 s upstream timeout. No timers; everything is lazy.
- **Stale rule:** upstream failing or frame older than 10 min = `stale: true` (last good frame still served). Frame older than 30 min, or never known = `available: false` and `imageUrl: null` (hide the overlay; never imply "no rain").
- Rate limit: 60 req/min per IP, shared `allowRequest` from `_shared/faaStatus.ts`. Anon key through the gateway, CORS like the other functions.
- All numbers (boxes, widths, cache, stale, backoff) are in `../_shared/radarConfig.ts`. Logic is in `../_shared/radar.ts`.

## Contract
`GET /functions/v1/live-radar?regions=conus,hi` (regions: `conus`, `ak`, `hi`, `carib`; no Guam) with `apikey` and `Authorization: Bearer <anon key>`:
```
{ attribution: "Radar: NOAA/NWS MRMS",
  regions: [{ region, observedAt /* ISO or null */, bbox: [west,south,east,north], width, height,
              imageUrl /* "?image=conus&t=<observedAt>" relative to the function URL, or null */,
              stale, available }] }
```
400 for no or unknown regions, 429 over the limit. Always 200 otherwise, even if NOAA is down (then `available: false`).

`GET /functions/v1/live-radar?image=conus&t=2026-10-14T07%3A16%3A16Z` (same auth headers) returns `image/png`,
`Cache-Control: public, max-age=300`, `X-Observed-At`. `t` must be within the last 2.5 h and not in the future (else 400).
If NOAA fails it returns the held frame with `X-Stale: true` and a 30 s max-age; 502 if it has none.
Images are equirectangular over exactly `bbox` (WMS `CRS:84`), transparent where there is no echo.

Region boxes and sizes (1 request each, 2026-10-14): conus [-130,20,-60,55] 1536x768 (191 KB); ak [-176,50,-126,72] 1536x676 (48 KB);
hi [-164,15,-151,26] 1024x866 (22 KB); carib [-90,10,-60,25] 1536x768 (51 KB). Sizes vary with the weather.

## App side
`useRadar(regions, { fetcher, config, refreshMs })` in `src/live/useRadar.ts` returns `{ frames, attribution, state }`.
Each frame has `image: { uri, headers }` (absolute URL plus the anon-key headers; pass both to the image loader),
`observedAt` (show "radar updated Xm ago" from it), `bbox`, `stale`, `available`. `state` is `off` (env missing or no regions),
`loading`, `ready` or `error`. Polls every 2 min by default (clamped 30 s to 10 min, backs off on failure; 0 = no polling).
Keep `useRadar`'s options (`fetcher`, `config`, `now`) stable (memoized), or it refetches every render. Skia's `useImage` cannot send headers, so item 14 should fetch the bytes with `image.headers` and pass the `Uint8Array` to Skia.

## Deploy (not done yet; ask John)
1. Same project as the other live functions (see `live-faa-status/README.md`).
2. `npx supabase functions deploy live-radar` (JWT verification stays on). No secrets needed.
3. Smoke test: `curl -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "$URL/functions/v1/live-radar?regions=hi"`.
