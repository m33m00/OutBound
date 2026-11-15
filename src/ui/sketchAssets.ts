// Made by design/landmark-sketches.py (round 221). Don't edit by hand; run the script again.
/* eslint-disable @typescript-eslint/no-require-imports */

/** The sketch box on a results ticket, in points, at its right edge above the perforation. */
export const SKETCH_W = 166;
export const SKETCH_H = 73;
/** Where the box starts on the 360 pt card the sketches were drawn on (for placing a state's circle). */
export const SKETCH_X0 = 186;
export const SKETCH_Y0 = 6;

/** A landmark for every airport in the app (round 221, John). */
export const LANDMARK_IMAGES: Readonly<Record<string, number>> = {
  ATL: require('../../assets/images/landmarks/atl.png'),
  BNA: require('../../assets/images/landmarks/bna.png'),
  CLT: require('../../assets/images/landmarks/clt.png'),
  DAL: require('../../assets/images/landmarks/dal.png'),
  DEN: require('../../assets/images/landmarks/den.png'),
  DFW: require('../../assets/images/landmarks/dfw.png'),
  LAX: require('../../assets/images/landmarks/lax.png'),
  LGA: require('../../assets/images/landmarks/lga.png'),
  MIA: require('../../assets/images/landmarks/mia.png'),
  ORD: require('../../assets/images/landmarks/ord.png'),
  PHX: require('../../assets/images/landmarks/phx.png'),
  SEA: require('../../assets/images/landmarks/sea.png'),
};

/** A state's outline, for a US airport with no landmark of its own yet. */
export const STATE_IMAGES: Readonly<Record<string, number>> = {
  AK: require('../../assets/images/states/ak.png'),
  AL: require('../../assets/images/states/al.png'),
  AR: require('../../assets/images/states/ar.png'),
  AZ: require('../../assets/images/states/az.png'),
  CA: require('../../assets/images/states/ca.png'),
  CO: require('../../assets/images/states/co.png'),
  CT: require('../../assets/images/states/ct.png'),
  DC: require('../../assets/images/states/dc.png'),
  DE: require('../../assets/images/states/de.png'),
  FL: require('../../assets/images/states/fl.png'),
  GA: require('../../assets/images/states/ga.png'),
  HI: require('../../assets/images/states/hi.png'),
  IA: require('../../assets/images/states/ia.png'),
  ID: require('../../assets/images/states/id.png'),
  IL: require('../../assets/images/states/il.png'),
  IN: require('../../assets/images/states/in.png'),
  KS: require('../../assets/images/states/ks.png'),
  KY: require('../../assets/images/states/ky.png'),
  LA: require('../../assets/images/states/la.png'),
  MA: require('../../assets/images/states/ma.png'),
  MD: require('../../assets/images/states/md.png'),
  ME: require('../../assets/images/states/me.png'),
  MI: require('../../assets/images/states/mi.png'),
  MN: require('../../assets/images/states/mn.png'),
  MO: require('../../assets/images/states/mo.png'),
  MS: require('../../assets/images/states/ms.png'),
  MT: require('../../assets/images/states/mt.png'),
  NC: require('../../assets/images/states/nc.png'),
  ND: require('../../assets/images/states/nd.png'),
  NE: require('../../assets/images/states/ne.png'),
  NH: require('../../assets/images/states/nh.png'),
  NJ: require('../../assets/images/states/nj.png'),
  NM: require('../../assets/images/states/nm.png'),
  NV: require('../../assets/images/states/nv.png'),
  NY: require('../../assets/images/states/ny.png'),
  OH: require('../../assets/images/states/oh.png'),
  OK: require('../../assets/images/states/ok.png'),
  OR: require('../../assets/images/states/or.png'),
  PA: require('../../assets/images/states/pa.png'),
  PR: require('../../assets/images/states/pr.png'),
  RI: require('../../assets/images/states/ri.png'),
  SC: require('../../assets/images/states/sc.png'),
  SD: require('../../assets/images/states/sd.png'),
  TN: require('../../assets/images/states/tn.png'),
  TX: require('../../assets/images/states/tx.png'),
  UT: require('../../assets/images/states/ut.png'),
  VA: require('../../assets/images/states/va.png'),
  VT: require('../../assets/images/states/vt.png'),
  WA: require('../../assets/images/states/wa.png'),
  WI: require('../../assets/images/states/wi.png'),
  WV: require('../../assets/images/states/wv.png'),
  WY: require('../../assets/images/states/wy.png'),
};

export interface StateFrame {
  lonMin: number;
  latMax: number;
  k: number;
  s: number;
  ox: number;
  oy: number;
}

/** How each state's lon/lat maps onto the 360 pt card the outline was drawn on. */
export const STATE_FRAMES: Readonly<Record<string, StateFrame>> = {
  AK: { lonMin: -187.5401, latMax: 71.35256, k: 0.48036, s: 2.48466, ox: 265.65053, oy: 22.0 },
  AL: { lonMin: -88.4746, latMax: 35.00832, k: 0.84231, s: 10.44753, ox: 284.23864, oy: 22.0 },
  AR: { lonMin: -94.61947, latMax: 36.49965, k: 0.82163, s: 14.30405, ox: 270.83006, oy: 22.0 },
  AZ: { lonMin: -114.81283, latMax: 37.00392, k: 0.82739, s: 8.81599, ox: 278.96329, oy: 22.0 },
  CA: { lonMin: -124.41061, latMax: 42.00966, k: 0.79577, s: 5.27681, ox: 278.42459, oy: 22.0 },
  CO: { lonMin: -109.0592, latMax: 41.00198, k: 0.77717, s: 12.47122, ox: 265.99417, oy: 22.0 },
  CT: { lonMin: -73.72619, latMax: 42.05089, k: 0.74875, s: 46.90022, ox: 265.96826, oy: 22.0 },
  DC: { lonMin: -77.11807, latMax: 38.99436, k: 0.77832, s: 246.62362, ox: 280.0198, oy: 22.0 },
  DE: { lonMin: -75.79003, latMax: 39.83882, k: 0.77555, s: 36.03912, ox: 289.66692, oy: 22.0 },
  FL: { lonMin: -87.6347, latMax: 31.00081, k: 0.88492, s: 7.70903, ox: 274.06952, oy: 22.0 },
  GA: { lonMin: -85.60675, latMax: 35.00059, k: 0.8417, s: 10.77238, ox: 278.40668, oy: 22.0 },
  HI: { lonMin: -160.24971, latMax: 22.23239, k: 0.93621, s: 15.08245, ox: 261.58284, oy: 22.0 },
  IA: { lonMin: -96.63306, latMax: 43.50013, k: 0.74385, s: 16.01628, ox: 261.32172, oy: 22.0 },
  ID: { lonMin: -117.24279, latMax: 49.00069, k: 0.70098, s: 7.13012, ox: 284.50923, oy: 22.0 },
  IL: { lonMin: -91.51473, latMax: 42.50877, k: 0.76896, s: 9.02795, ox: 286.04632, oy: 22.0 },
  IN: { lonMin: -88.09772, latMax: 41.76053, k: 0.76866, s: 12.53568, ox: 284.03888, oy: 22.0 },
  KS: { lonMin: -102.05289, latMax: 40.0029, k: 0.78263, s: 13.69837, ox: 260.0, oy: 30.76591 },
  KY: { lonMin: -89.57292, latMax: 39.14641, k: 0.78992, s: 13.31575, ox: 260.0, oy: 36.72205 },
  LA: { lonMin: -94.04159, latMax: 33.0196, k: 0.8574, s: 12.22499, ox: 272.61138, oy: 22.0 },
  MA: { lonMin: -73.50724, latMax: 42.88676, k: 0.74241, s: 30.11218, ox: 260.0, oy: 22.38486 },
  MD: { lonMin: -79.487, latMax: 39.72284, k: 0.77912, s: 23.14506, ox: 260.0, oy: 30.20595 },
  ME: { lonMin: -71.08447, latMax: 47.45953, k: 0.7039, s: 11.36337, ox: 283.59253, oy: 22.0 },
  MI: { lonMin: -90.4164, latMax: 48.19059, k: 0.70781, s: 7.69883, ox: 278.20143, oy: 22.0 },
  MN: { lonMin: -97.23965, latMax: 49.38469, k: 0.68909, s: 8.49557, ox: 277.31705, oy: 22.0 },
  MO: { lonMin: -95.76804, latMax: 40.61369, k: 0.78473, s: 10.82648, ox: 271.67102, oy: 22.0 },
  MS: { lonMin: -91.64394, latMax: 34.99544, k: 0.84257, s: 10.38415, ox: 284.48646, oy: 22.0 },
  MT: { lonMin: -116.05114, latMax: 49.00155, k: 0.68607, s: 9.70923, ox: 260.0, oy: 26.91795 },
  NC: { lonMin: -84.32178, latMax: 36.58813, k: 0.81695, s: 11.05009, ox: 260.0, oy: 41.75629 },
  ND: { lonMin: -104.04854, latMax: 49.00069, k: 0.67601, s: 15.79822, ox: 260.0, oy: 23.56292 },
  NE: { lonMin: -104.05213, latMax: 43.00101, k: 0.74895, s: 12.21665, ox: 260.0, oy: 35.34156 },
  NH: { lonMin: -72.55608, latMax: 45.30587, k: 0.71932, s: 19.16469, ox: 287.23401, oy: 22.0 },
  NJ: { lonMin: -75.56032, latMax: 41.35763, k: 0.76444, s: 20.58104, ox: 286.89893, oy: 22.0 },
  NM: { lonMin: -109.04843, latMax: 37.00048, k: 0.82741, s: 8.82134, ox: 277.9284, oy: 22.0 },
  NV: { lonMin: -120.00654, latMax: 42.00193, k: 0.78259, s: 7.14237, ox: 283.32804, oy: 22.0 },
  NY: { lonMin: -79.76338, latMax: 45.01551, k: 0.73422, s: 11.07788, ox: 267.843, oy: 22.0 },
  OH: { lonMin: -84.82069, latMax: 41.97787, k: 0.76389, s: 13.99451, ox: 277.016, oy: 22.0 },
  OK: { lonMin: -103.00406, latMax: 37.0022, k: 0.81604, s: 11.43757, ox: 260.0, oy: 33.27748 },
  OR: { lonMin: -124.55418, latMax: 46.26802, k: 0.71776, s: 11.69208, ox: 266.05261, oy: 22.0 },
  PA: { lonMin: -80.52072, latMax: 42.26995, k: 0.75477, s: 18.19493, ox: 260.0, oy: 25.60859 },
  PR: { lonMin: -67.94024, latMax: 18.51609, k: 0.94989, s: 30.99627, ox: 260.0, oy: 53.28076 },
  RI: { lonMin: -71.85975, latMax: 42.01911, k: 0.74797, s: 57.6269, ox: 284.0649, oy: 22.0 },
  SC: { lonMin: -83.34908, latMax: 35.21536, k: 0.83268, s: 15.71784, ox: 268.52573, oy: 22.0 },
  SD: { lonMin: -104.05931, latMax: 45.94501, k: 0.71673, s: 14.44965, ox: 260.52282, oy: 22.0 },
  TN: { lonMin: -90.30872, latMax: 36.67833, k: 0.81075, s: 11.39292, ox: 260.0, oy: 52.68007 },
  TX: { lonMin: -106.64719, latMax: 36.50051, k: 0.85563, s: 4.6904, ox: 273.65373, oy: 22.0 },
  UT: { lonMin: -114.0519, latMax: 42.00193, k: 0.77163, s: 9.99196, ox: 280.6838, oy: 22.0 },
  VA: { lonMin: -83.67571, latMax: 39.46598, k: 0.78797, s: 12.03653, ox: 260.0, oy: 36.79197 },
  VT: { lonMin: -73.43904, latMax: 45.01551, k: 0.7209, s: 21.84804, ox: 284.67977, oy: 22.0 },
  WA: { lonMin: -124.73364, latMax: 49.00241, k: 0.6785, s: 14.45682, ox: 261.65908, oy: 22.0 },
  WI: { lonMin: -92.88943, latMax: 47.07725, k: 0.70976, s: 10.90355, ox: 276.52818, oy: 22.0 },
  WV: { lonMin: -82.6384, latMax: 40.6386, k: 0.77802, s: 14.54716, ox: 272.17275, oy: 22.0 },
  WY: { lonMin: -111.05843, latMax: 45.00606, k: 0.73135, s: 12.46588, ox: 268.0622, oy: 22.0 },
};
