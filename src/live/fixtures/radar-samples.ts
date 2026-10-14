// Real GetCapabilities excerpt for conus_bref_qcd, captured 2026-10-14 from opengeo.ncep.noaa.gov
// (time list shortened to the last 5 of 56 values; the default attribute is the latest frame).
export const CONUS_CAPABILITIES = `<?xml version="1.0" encoding="UTF-8"?><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">
  <Service><Name>WMS</Name><Fees>none</Fees><AccessConstraints>none</AccessConstraints></Service>
  <Capability>
    <Layer>
      <Layer queryable="1" opaque="0">
        <Name>conus_bref_qcd</Name>
        <Title>conus_bref_qcd</Title>
        <CRS>EPSG:4326</CRS>
        <CRS>CRS:84</CRS>
        <BoundingBox CRS="CRS:84" minx="-130.0" miny="20.000000782311" maxx="-60.0000015646219" maxy="55.0"/>
        <Dimension name="time" default="2026-10-14T07:16:16Z" units="ISO8601" nearestValue="1">2026-10-14T07:08:09.000Z,2026-10-14T07:10:03.000Z,2026-10-14T07:12:13.000Z,2026-10-14T07:14:08.000Z,2026-10-14T07:16:16.000Z</Dimension>
      </Layer>
    </Layer>
  </Capability>
</WMS_Capabilities>`;

export const CONUS_LATEST_ISO = '2026-10-14T07:16:16Z';
export const CONUS_LATEST_MS = Date.parse(CONUS_LATEST_ISO);

/** Same document without the default attribute (parser must fall back to the last listed time). */
export const CAPABILITIES_NO_DEFAULT = CONUS_CAPABILITIES.replace(' default="2026-10-14T07:16:16Z"', '');

/** 1x1 transparent PNG (stands in for a radar image in tests). */
export const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
export const tinyPng = (): Uint8Array => Uint8Array.from(atob(TINY_PNG_BASE64), (c) => c.charCodeAt(0));
