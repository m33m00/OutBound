/**
 * Public contract of the map module. Screens import only from `@/map`
 * (this file's types plus the `GlobeMap` component), never Skia or d3,
 * so the renderer can be swapped without touching screens.
 *
 * Globe v1 (backlog item 2): ocean, land, country borders, US state lines,
 * drag to rotate, pinch to zoom.
 * Item 4: route arcs (overview, selected, ghosts), tap to select, route-box
 * camera fit and fly-to, legend while a route is selected.
 * Accepted but not drawn yet: marks (item 9), airport status (item 7).
 */
import type { StyleProp, ViewStyle } from 'react-native';

/** [longitude, latitude] in degrees, d3/GeoJSON order. */
export type LonLat = readonly [lon: number, lat: number];

/** Seat tiers (DECISIONS.md "Theme tokens"). */
export type SeatTier = 'wide' | 'good' | 'okay' | 'tight' | 'full' | 'unknown';

/** Where a leg's seat data came from. Solid line = reported; dashed = the rest. */
export type LineSource = 'reported' | 'estimate' | 'typical' | 'unknown';

/**
 * One flight leg drawn as an arc. Legs are flights only: a ground transfer
 * between nearby airports is not a leg and gets no arc (the next leg simply
 * starts at the other airport).
 */
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

/**
 * One itinerary (0-3 stops) = ordered legs.
 *
 * Path grouping (assumption, item 4): routes whose legs have the same
 * fromCode/toCode sequence share a "path" (see `routePathKey`). The map
 * draws a path once, and tapping a ghost selects the earliest-arriving
 * option on that path, taken to be the FIRST RouteLine in `routes` with that
 * path. So pass routes sorted by arrival when that matters (the engine does).
 */
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
 * - 'fit': frame a set of points (a route box) inside the visible area,
 *   with padding. Use `routeFrameTarget` to build one from routes.
 * Target changes fly (about 0.9 s) unless Reduce Motion is on, then jump.
 */
export type CameraTarget =
  | { kind: 'center'; center: LonLat; zoom?: number }
  | { kind: 'fit'; points: readonly LonLat[] };

export interface GlobeMapProps {
  /**
   * Routes in the current sort order. The first MAP_ROUTE_LIMIT (10) are
   * drawn, plus the selected route if it is further down. All of them are
   * used for path grouping (ghost taps).
   */
  routes?: readonly RouteLine[];
  /**
   * Selected route id. Controlled when not undefined (string or null);
   * when undefined the map keeps its own selection (handy for previews).
   */
  selectedRouteId?: string | null;
  /**
   * Called with a route id when a line is tapped (a ghost resolves to the
   * earliest-arriving route on its path), and with null when empty map is
   * tapped while a route is selected (Q-018).
   */
  onSelectRoute?: (routeId: string | null) => void;
  /** Later: item 9. */
  homeAirports?: readonly MapAirport[];
  /** Later: item 9. */
  origin?: MapAirport | null;
  /** Later: item 9. */
  destinations?: readonly MapAirport[];
  /** Later: item 7. */
  airportStatus?: readonly AirportStatusMark[];
  /**
   * Applied whenever its value changes (fly-to, or jump with Reduce Motion).
   * When undefined, the map frames itself: the selected route's box, else
   * the overview box of the drawn routes, else the default view.
   */
  cameraTarget?: CameraTarget;
  /** UI covering the map; the camera frames inside what is left. */
  insets?: Partial<MapInsets>;
  /** Drag/pinch enabled. Default true. */
  interactive?: boolean;
  /**
   * Show the line legend while a route is selected (DECISIONS.md "Map").
   * Default true; it sits bottom-left inside `insets`. Set false to place
   * `RouteLegend` yourself.
   */
  showLegend?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hit area for tapping a route line (DECISIONS.md "Map"): a tap counts if it
 * is within this many pt of the drawn line (as in the v9.1 prototype).
 */
export const MAP_LINE_HIT_AREA = 28;

/** Results overview draws the top this-many routes (DECISIONS.md "Map"). */
export const MAP_ROUTE_LIMIT = 10;
