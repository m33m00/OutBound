/**
 * Public contract of the map module. Screens import only from `@/map`
 * (this file's types plus the `GlobeMap` component), never Skia or d3,
 * so the renderer can be swapped without touching screens.
 *
 * Globe v1 (backlog item 2) implements: ocean, land, country borders,
 * US state lines, drag to rotate, pinch to zoom, `cameraTarget` of kind
 * 'center' (instant, no animation). Everything else here is typed now so the
 * props stay stable, and is accepted but not drawn yet (see "Later" notes).
 */
import type { StyleProp, ViewStyle } from 'react-native';

/** [longitude, latitude] in degrees, d3/GeoJSON order. */
export type LonLat = readonly [lon: number, lat: number];

/** Seat tiers (DECISIONS.md "Theme tokens"). */
export type SeatTier = 'wide' | 'good' | 'okay' | 'tight' | 'full' | 'unknown';

/** Where a leg's seat data came from. Solid line = reported; dashed = the rest. */
export type LineSource = 'reported' | 'estimate' | 'typical' | 'unknown';

/** One flight leg drawn as an arc. Later: item 4. */
export interface RouteLeg {
  id: string;
  from: LonLat;
  to: LonLat;
  /** IATA codes, for labels and accessibility. */
  fromCode: string;
  toCode: string;
  tier: SeatTier;
  source: LineSource;
}

/** One itinerary (0-3 stops) = ordered legs. Later: item 4. */
export interface RouteLine {
  id: string;
  legs: readonly RouteLeg[];
}

/** An airport mark (home pin, origin dot, destination ring). Later: item 9. */
export interface MapAirport {
  code: string;
  coord: LonLat;
}

/** Disruption level shown on an airport (DECISIONS.md "Weather"). Later: item 7. */
export type AirportStatusLevel = 'caution' | 'likelyDelays';

export interface AirportStatusMark {
  code: string;
  coord: LonLat;
  level: AirportStatusLevel;
}

/** Screen space covered by other UI (top bar, bottom panel, map buttons), in pt. */
export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * What the camera should frame. The globe is centered in the area left
 * after `insets`, so a bottom panel never hides the target.
 * - 'center': look at a point. `zoom` 1 = the whole globe fits the visible area.
 * - 'fit': frame a set of points (a route box). Later: item 4. In v1 it
 *   centers on the points' centroid and keeps the current zoom.
 */
export type CameraTarget =
  | { kind: 'center'; center: LonLat; zoom?: number }
  | { kind: 'fit'; points: readonly LonLat[] };

export interface GlobeMapProps {
  /** Top routes to draw. Later: item 4 (accepted, not drawn in v1). */
  routes?: readonly RouteLine[];
  /** Selected route id. Later: item 4. */
  selectedRouteId?: string | null;
  /** Called with a route id when a line is tapped, null when empty map is tapped. Later: item 4. */
  onSelectRoute?: (routeId: string | null) => void;
  /** Later: item 9. */
  homeAirports?: readonly MapAirport[];
  /** Later: item 9. */
  origin?: MapAirport | null;
  /** Later: item 9. */
  destinations?: readonly MapAirport[];
  /** Later: item 7. */
  airportStatus?: readonly AirportStatusMark[];
  /** Applied whenever its value changes. v1 jumps instantly (fly-to is item 4). */
  cameraTarget?: CameraTarget;
  /** UI covering the map; the camera frames inside what is left. */
  insets?: Partial<MapInsets>;
  /** Drag/pinch enabled. Default true. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Hit area for tapping a route line (DECISIONS.md "Map"). Used from item 4. */
export const MAP_LINE_HIT_AREA = 28;
