/**
 * Bundled base-map geography, decoded from TopoJSON once (never per frame).
 * Sources and licenses: src/map/README.md. No network calls.
 *
 * - 110m land + country borders and US state lines decode at module load.
 * - 50m land + borders decode lazily the first time the camera zooms in far
 *   enough, then stay cached. Their JSON is only required at that point.
 */
import type { GeoPermissibleObjects } from 'd3-geo';
import type { MultiLineString } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export interface BaseGeo {
  land: GeoPermissibleObjects;
  /** Internal borders between countries (no coastlines). */
  borders: MultiLineString;
}

export type GeoDetail = 'low' | 'high';

function objectOf(topo: Topology, key: string): GeometryCollection {
  const obj = topo.objects[key];
  if (!obj || obj.type !== 'GeometryCollection') {
    throw new Error(`TopoJSON is missing GeometryCollection "${key}"`);
  }
  return obj as GeometryCollection;
}

/** Land polygons from a world-atlas land-*.json topology. */
export function decodeLand(topo: Topology): GeoPermissibleObjects {
  return feature(topo, objectOf(topo, 'land'));
}

/** Shared edges only (a !== b), so coastlines are not drawn twice. */
export function decodeInnerMesh(topo: Topology, key: string): MultiLineString {
  return mesh(topo, objectOf(topo, key), (a, b) => a !== b);
}

/* eslint-disable @typescript-eslint/no-require-imports */
const low: BaseGeo = {
  land: decodeLand(require('world-atlas/land-110m.json') as Topology),
  borders: decodeInnerMesh(require('world-atlas/countries-110m.json') as Topology, 'countries'),
};

const stateLines: MultiLineString = decodeInnerMesh(
  require('us-atlas/states-10m.json') as Topology,
  'states',
);

let high: BaseGeo | null = null;

export function getBaseGeo(detail: GeoDetail): BaseGeo {
  if (detail === 'low') return low;
  if (!high) {
    high = {
      land: decodeLand(require('world-atlas/land-50m.json') as Topology),
      borders: decodeInnerMesh(require('world-atlas/countries-50m.json') as Topology, 'countries'),
    };
  }
  return high;
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** Lines between US states (Census cartographic boundaries via us-atlas). */
export function getStateLines(): MultiLineString {
  return stateLines;
}
