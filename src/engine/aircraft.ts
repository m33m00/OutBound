/**
 * Aircraft type for a flight leg (round 138, John: "add aircraft type").
 * The schedule DB keeps the provider's model name ("Boeing 737-800", "Airbus A321 NEO"); the app shows the short
 * name crews use ("737-800", "A321neo").
 */

/** Provider model name -> short display name. Null when there is nothing to show. */
export function aircraftLabel(model: string | null | undefined): string | null {
  const raw = typeof model === 'string' ? model.replace(/\s+/g, ' ').trim() : '';
  if (!raw) return null;
  let s = raw
    .replace(/^(the )?boeing\s*/i, '')
    .replace(/^airbus\s*/i, '')
    .replace(/^(embraer|bombardier|canadair|mitsubishi|de havilland( canada)?)\s*/i, '');
  // "A321 NEO" / "A320neo" / "737 MAX 8" keep one spelling each.
  s = s.replace(/\s*neo\b/i, 'neo').replace(/\s*\(sharklets\)/i, '');
  // Embraer models go by their E name ("Embraer 175" -> "E175", "ERJ-175" -> "E175").
  if (/^embraer/i.test(raw)) s = s.replace(/^(e|erj)?[- ]?(\d{3})\b/i, 'E$2');
  // Airbus models without the A ("Airbus 321") get it back.
  if (/^airbus/i.test(raw) && /^\d{3}/.test(s)) s = `A${s}`;
  s = s.replace(/^crj\s*-?\s*(\d)/i, 'CRJ$1').replace(/^a(\d)/, 'A$1');
  return s.length > 0 && s.length <= 16 ? s : raw.slice(0, 16);
}

/** SAMPLE DATA: types each airline really flies, picked by block time so long legs get the bigger planes. */
const SAMPLE_FLEET: Record<string, { short: readonly string[]; long: readonly string[] }> = {
  AA: { short: ['737-800', 'A321', 'A319', 'E175'], long: ['A321neo', '737-800', '737 MAX 8'] },
  DL: { short: ['A220-300', 'A321', '737-900', 'CRJ900'], long: ['A321neo', '757-200', '737-900'] },
  UA: { short: ['737-800', 'A320', 'E175', '737 MAX 8'], long: ['737 MAX 9', '757-300', '737-900'] },
  WN: { short: ['737-700', '737-800', '737 MAX 8'], long: ['737-800', '737 MAX 8'] },
  AS: { short: ['737-900', 'E175'], long: ['737 MAX 9', '737-900'] },
  B6: { short: ['A320', 'A220-300'], long: ['A321neo', 'A321'] },
  F9: { short: ['A320neo'], long: ['A321neo'] },
  NK: { short: ['A320neo', 'A321'], long: ['A321neo'] },
};

/** SAMPLE DATA aircraft for a scheduled leg, stable per flight number. */
export function sampleAircraft(airline: string, flightNumber: string, blockMin: number): string | undefined {
  const fleet = SAMPLE_FLEET[airline];
  if (!fleet) return undefined;
  const list = blockMin >= 180 ? fleet.long : fleet.short;
  const n = Number.parseInt(flightNumber, 10) || 0;
  return list[n % list.length];
}
