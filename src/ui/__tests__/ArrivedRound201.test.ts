/**
 * Round 201 (John: "Different colors for departed and arrived"): Arrived has its own graphite tone
 * everywhere a pill shows, Departed keeps sky cyan.
 */
import type { Itinerary } from '@/engine';
import { statusHeadline } from '@/search/headline';
import type { RowStatus } from '@/search/statusTags';
import { colors } from '@/theme';

import { TAG_TONE } from '../StatusTag';
import { STATE_TONE, TONE_BG, TONE_FG } from '../statusTone';

const tag = (kind: 'departed' | 'arrived') => ({ kind, label: kind === 'arrived' ? 'Arrived' : 'Departed', spoken: kind });
const status = (kind: 'departed' | 'arrived') =>
  ({ legs: [{ tag: tag(kind) }], risks: [], dimmed: true, canceled: false, spoken: [] }) as unknown as RowStatus;
const route = { legs: [{}], connections: [] } as unknown as Itinerary;

describe('Departed and Arrived tones (round 201)', () => {
  it('maps Arrived to its own tone and Departed to the old one', () => {
    expect(TAG_TONE.arrived).toBe('landed');
    expect(TAG_TONE.departed).toBe('gone');
    expect(STATE_TONE.arrived).toBe('landed');
    expect(STATE_TONE.departed).toBe('gone');
  });

  it('uses two different color pairs, in light and dark', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = colors[scheme];
      expect(p[TONE_BG.landed]).not.toBe(p[TONE_BG.gone]);
      expect(p[TONE_FG.landed]).not.toBe(p[TONE_FG.gone]);
    }
  });

  it("gives a ticket's headline the right tone", () => {
    expect(statusHeadline(route, status('arrived'))).toMatchObject({ label: 'Arrived', tone: 'landed' });
    expect(statusHeadline(route, status('departed'))).toMatchObject({ label: 'Departed', tone: 'gone' });
  });
});
