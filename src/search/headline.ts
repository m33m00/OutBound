/**
 * The route card's one headline (design audit, John 2026-10-31 picked A): the
 * thing that matters most right now. A live problem leads; with none, the
 * route's chance word does.
 */
import type { Itinerary } from '@/engine';

import type { RowStatus } from './statusTags';

export type HeadlineTone = 'canceled' | 'delayed' | 'gone';

export interface StatusHeadline {
  label: string;
  tone: HeadlineTone;
}

const leg = (it: Itinerary, i: number) => `${it.legs[i].flight.from} → ${it.legs[i].flight.to}`;

/**
 * A live problem worth leading with, worst first: a canceled or diverted
 * flight, a connection at risk, the first flight gone, then delays. Null when
 * nothing live is wrong, so the chance word leads. On a route with more than
 * one flight the label names which one.
 */
export function statusHeadline(it: Itinerary, status: RowStatus | undefined): StatusHeadline | null {
  if (!status) return null;
  const many = it.legs.length > 1;
  const broken = status.legs.findIndex((l) => l.tag?.kind === 'canceled' || l.tag?.kind === 'diverted');
  if (broken >= 0) {
    const word = status.legs[broken].tag!.label;
    return { label: many ? `${leg(it, broken)} ${word.toLowerCase()}` : word, tone: 'canceled' };
  }
  const risk = status.risks[0];
  if (risk) return { label: `Connection at risk at ${risk.airport}`, tone: 'delayed' };
  if (status.dimmed) return { label: status.legs[0]?.tag?.label ?? 'Departed', tone: 'gone' };
  const delayed = status.legs.flatMap((l, i) => (l.tag?.kind === 'delayed' ? [i] : []));
  if (delayed.length > 1) return { label: `${delayed.length} flights delayed`, tone: 'delayed' };
  if (delayed.length === 1) {
    const word = status.legs[delayed[0]].tag!.label;
    return { label: many ? `${leg(it, delayed[0])} ${word.toLowerCase()}` : word, tone: 'delayed' };
  }
  return null;
}
