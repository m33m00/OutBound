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

## Rendering
Two cached Skia Pictures, re-recorded only when camera, size, theme or gesture state changes:
1. base: space, atmosphere glow, ocean, land, country borders, US state lines
2. (dynamic slot: routes, marks, airport status; items 4, 7, 9)
3. rim: limb darkening and globe edge

While a finger is moving, the base layer is recorded in "fast" mode, as the prototype does: lower projection precision, 110m data only, no state lines. They come back when the gesture ends. Natural Earth 50m replaces 110m when the globe radius is more than 2.1 view widths.

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
