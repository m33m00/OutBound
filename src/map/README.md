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
- `useReduceMotion.ts`: live Reduce Motion setting.
- `devSampleRoutes.ts`: hardcoded sample routes for previews (`<GlobeMap routes={devSampleRoutes} />`).

## Rendering
Two cached Skia Pictures, re-recorded only when camera, size, theme or gesture state changes:
1. base: space, atmosphere glow, ocean, land, country borders, US state lines
2. routes picture (item 4): re-recorded on camera, routes, selection or theme change; a selection change does not touch 1 or 3. Marks and airport status (items 9, 7) go here too.
3. rim: limb darkening and globe edge

While a finger is moving or the camera is flying, the base layer is recorded in "fast" mode, as the prototype does: lower projection precision, 110m data only, no state lines. They come back when the gesture ends. Natural Earth 50m replaces 110m when the globe radius is more than 2.1 view widths.

## Prototype features not drawn in v1
- City labels (item 9, with the other marks and labels).
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
- Chevrons: item 9.
