# src/map

The globe. Screens import only from `@/map` (`GlobeMap` and its types), never Skia or d3, so the renderer can be swapped later.

## Files
- `types.ts`: public contract (`GlobeMapProps`, `RouteLine`, `CameraTarget`, `MapInsets`, ...).
- `GlobeMap.tsx`: component. Skia canvas, drag to rotate, pinch to zoom.
- `camera.ts`: pure camera math (clamps, pan/pinch, target -> camera, d3 projection).
- `geo.ts`: decodes the bundled TopoJSON once.
- `paths.ts`: geography -> SVG path string (one native call per layer).
- `staticLayer.ts`: records the static globe as Skia Pictures.
- `globeColors.ts`: globe colors mapped from the theme.
- `arcs.ts`: great-circle arc samples (cached per leg), lifted projection with far-side occlusion.
- `routeModel.ts`: top-10 drawn set, path grouping, ghost-tap resolution, line styles, legend entries.
- `hitTest.ts`: 28pt tap hit testing on projected lines.
- `framing.ts`: auto camera target (selected route box, else overview box, else default view).
- `flyTo.ts`: fly-to easing/interpolation and the Reduce Motion branch.
- `routeLayer.ts`: records the arcs as a Skia Picture and returns the hit lines.
- `RouteLegend.tsx`: line legend shown while a route is selected.
- `marks.ts`: pure mark logic (item 9): which marks show, label placement (flip/nudge), chevron geometry, mark colors, accessibility summary.
- `markFonts.ts`: loads Big Shoulders Display (600/700) into Skia from the bundled theme font files.
- `marksLayer.ts`: records marks and labels as a Skia Picture.
- `useReduceMotion.ts`: live Reduce Motion setting (plus `known`, so the spin-in waits for it).
- `sun.ts`: pure sun position, night/dusk alpha curve, sun keying and sky throttle (item 11).
- `nightLayer.ts`: records day/night (RuntimeEffect shader) and the sun highlight as a Skia Picture.
- `spinIn.ts`: launch spin-in start camera and once-per-launch rule.
- `preview.ts`: pure flight preview timeline, plane pose and run state machine.
- `useFlightPreview.ts`: preview frame loop and React state.
- `previewLayer.ts`: records the plane glyph once per accent; per frame only a transform changes (Reanimated shared value read by Skia, no React re-render).
- `devSampleRoutes.ts`: hardcoded sample routes for previews (`<GlobeMap routes={devSampleRoutes} />`).

## Rendering
Cached Skia Pictures (see also Polish below for night and plane), re-recorded only when camera, size, theme or gesture state changes:
1. base: space, atmosphere glow, ocean, land, country borders, US state lines
2. routes picture (item 4): re-recorded on camera, routes, selection or theme change; a selection change does not touch 1 or 3. Includes the selected route's chevrons.
3. rim: limb darkening and globe edge
4. marks picture (item 9): dynamic like 2, drawn above the rim so the limb never dims a label. Airport status badges (item 7, `status.ts`) are drawn in it too, after the marks, and act as label obstacles.

While a finger is moving or the camera is flying, the base layer is recorded in "fast" mode, as the prototype does: lower projection precision, 110m data only, no state lines. They come back when the gesture ends. Natural Earth 50m replaces 110m when the globe radius is more than 2.1 view widths.

## Polish (item 11)
- Layer order: base, night, radar, routes, rim, marks, plane. Night is under radar so radar colors are never tinted (Q-033).
- Day/night: one RuntimeEffect shader draw over the globe (per-pixel sphere normal dotted with the view-space sun), same curve as the prototype; plus a white 16% sun highlight (0.55 R) that fades near the limb. No sun disc, labels or city lights (Q-037). Re-recorded on camera/size/theme change and when the sun moved 0.1 deg; the real-time clock ticks once a minute and on return to the foreground. Shown under Reduce Motion (static).
- Spin-in: once per app launch on the first layout: rotated +150/+18 deg, radius 0.36 min(W, H), center at 0.36 H, then 2100 ms cubic in/out to the first camera. Any touch snaps to the end. Skipped under Reduce Motion.
- Flight preview: `preview` prop (selected route + nonce). Plane flies every leg (2600 ms + 3000 ms/rad, 900 ms waits, 450 ms delay, 2600 ms hold), the sky follows `departUtc`/`arriveUtc` at ~9 Hz (real time if any leg lacks times), radar hidden while playing, camera fits the route once. `onPreviewState` at most ~5 Hz. Any touch, deselect, route change, null or a new nonce cancels; a tap that only stopped a preview does nothing else. Reduce Motion: reported 'cancelled' with simUtc null.

## Prototype features not drawn in v1
- Graticule (faint lat/long grid), lakes, timezone lines, stars: not in item 2's scope; open question for John.
- Never built (DECISIONS.md): city lights, terrain, clock/time slider, weather key.

## Data (bundled, no network)
| Layer | Package | Underlying data | License |
|---|---|---|---|
| Land 110m / 50m | `world-atlas` 2.0.2 (`land-110m.json`, `land-50m.json`) | Natural Earth | Natural Earth: public domain. Package: ISC (c) Mike Bostock |
| Country borders 110m / 50m | `world-atlas` 2.0.2 (`countries-*.json`) | Natural Earth | same |
| US state lines | `us-atlas` 3.0.1 (`states-10m.json`) | US Census Bureau cartographic boundary files (1:10m) | Census data: public domain (US government work). Package: ISC (c) Mike Bostock |

The v9.1 prototype embeds Natural Earth 110m/50m land and borders the same way.

## Colors
Ice Mix values from the prototype (base `:root` and dark), with space and state lines taken from theme tokens. See `globeColors.ts`.

## Routes (item 4)
- Top 10 routes (plus the selected one if lower in the list). Overview: 1.5pt solid, light `muted` at 90%, dark `text` at 70%, deduped per airport pair. Selected: tier token per leg, 3.6pt, halo (`surface` 90%, +3.4pt), solid with tier glow if reported, dashed 8/6 otherwise; typical/unknown sources draw `unknown` gray. Ghosts: same token at 30%, 1.5pt. Legend: the Unknown swatch is dashed when all its legs are dashed.
- Arcs are lifted off the surface like the prototype (peak 1.2%-12.2% of the radius by length) with a ground shadow under the selected route. Far side is hidden by sphere occlusion (surface points = clipAngle 90).
- Tap: within 28pt of a line; the selected route wins when in range, else nearest, ties to the earlier route. A ghost tap selects the first route in `routes` on the same airport path. Empty map with a selection deselects. Pan/pinch beyond 6pt never ends in a tap.
- Camera: with no `cameraTarget`, the map frames the selected route, else the overview, inside `insets` with 32pt padding. Fly-to 900 ms cubic ease-in-out with a 12% mid-flight zoom-out; jumps when Reduce Motion is on.
- Chevrons: item 9, see Marks.

## Marks (item 9)
- Not tappable; route hit testing and empty-tap deselect are unchanged.
- Home: first home = amber (`you`) pin r 9 with soft shadow, `onAccent` ring and house glyph; further homes = outline pin r 7 (`surface` 90% fill, `you` stroke and glyph). Homes within 0.016 rad (~100 km) share a pin labeled "JFK/LGA". Home pins draw on top; a home code gets no other mark.
- Origin: `accent` dot r 3.6 with `surface` 90% ring 1.6. Destinations: hollow `accent` ring r 4.5, 2.2. Selected route only: its other airports get a hollow `text` ring r 3.2, 1.6, with labels.
- Labels: IATA in Big Shoulders Display; home/origin/destination 700 12.5pt, connections 600 11.5pt, alt homes 600 11pt; `text` on a `surface` 90% halo (3.5pt, alt home 3pt). Placement (`placeLabels`): homes first, right of the mark, flipped left when it would pass the visible area's right edge minus 66pt (map buttons); nudged (-6 then +9; homes 0, -12, +12) to avoid placed labels and marks.
- Chevrons: selected route only, at t = 0.2 / 0.66 / 0.88 of each leg's lifted arc, size 4.5, tier color 2.2pt, always solid, `surface` 95% halo 5pt. Overview and ghosts get none.
- Far side: marks behind the globe or far off screen are skipped.
- Accessibility: the map label adds "Home BNA. Origin DFW. Destination LAX."
