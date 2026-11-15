/**
 * A quiet color for where a ticket goes (round 219, John picked option 1 of the destination mockups: "I like this
 * one"): a thin stripe down the ticket's left edge and a faint tint under the perforation. Muted on purpose, so it
 * never fights boarding blue, the seat colors on the route line, or red for canceled.
 */
import { AIRPORTS } from '@/engine';

export type DestinationTone = 'coast' | 'mountain' | 'desert' | 'northwest' | 'northeast' | 'heartland' | 'south' | 'abroad';

/** Each tone's color, the same in light and dark mode; only the tint's strength changes. */
export const TONE_COLOR: Record<DestinationTone, string> = {
  coast: '#D9826B', // coral: Florida, the islands, Hawaii, the beaches south of the border
  mountain: '#557A6A', // pine: the Rockies
  desert: '#C99A55', // amber: California and the Southwest
  northwest: '#5E8C93', // misty teal: Seattle, Portland, Alaska
  northeast: '#6B7A8F', // slate: New York, Boston, DC and up the coast
  heartland: '#8A7393', // dusk plum: the Midwest and Great Lakes
  south: '#B07A5B', // clay: Texas and the South
  abroad: '#A0937A', // sand: anywhere else
};

const BY_STATE: Partial<Record<string, DestinationTone>> = {
  FL: 'coast',
  HI: 'coast',
  PR: 'coast',
  VI: 'coast',
  CO: 'mountain',
  UT: 'mountain',
  MT: 'mountain',
  WY: 'mountain',
  ID: 'mountain',
  CA: 'desert',
  NV: 'desert',
  AZ: 'desert',
  NM: 'desert',
  WA: 'northwest',
  OR: 'northwest',
  AK: 'northwest',
  NY: 'northeast',
  NJ: 'northeast',
  CT: 'northeast',
  MA: 'northeast',
  RI: 'northeast',
  NH: 'northeast',
  VT: 'northeast',
  ME: 'northeast',
  PA: 'northeast',
  DE: 'northeast',
  MD: 'northeast',
  DC: 'northeast',
  VA: 'northeast',
  IL: 'heartland',
  IN: 'heartland',
  OH: 'heartland',
  MI: 'heartland',
  WI: 'heartland',
  MN: 'heartland',
  IA: 'heartland',
  MO: 'heartland',
  KS: 'heartland',
  NE: 'heartland',
  ND: 'heartland',
  SD: 'heartland',
};

/** Where `code` sits, for its ticket's color. Unknown airports fall back to sand. */
export function destinationTone(code: string): DestinationTone {
  const a = AIRPORTS[code];
  if (!a) return 'abroad';
  if ((a.country ?? 'US') === 'US') return (a.region && BY_STATE[a.region]) || 'south';
  // Mexico's beaches, the Caribbean and Central America read as the coast; the rest as abroad.
  if (a.lat < 26 && a.lon > -110 && a.lon < -59) return 'coast';
  return 'abroad';
}

/** How strong the tint under the perforation is: faint on white, a touch more on dark paper. */
export const TONE_TINT_ALPHA = { light: 0.09, dark: 0.14 } as const;

/** `#RRGGBB` at `alpha`, as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
