import type { Itinerary } from '@/engine';

import { statusHeadline } from '../headline';
import type { LegStatusView, RowStatus } from '../statusTags';

const leg = (from: string, to: string) => ({ flight: { from, to } });
const two = { legs: [leg('DFW', 'PHX'), leg('PHX', 'LAX')] } as unknown as Itinerary;
const one = { legs: [leg('DFW', 'LAX')] } as unknown as Itinerary;
const view = (tag: LegStatusView['tag'] = null): LegStatusView =>
  ({ tag, struck: false, scheduledUtc: 0, scheduledText: '', newUtc: null, newText: null }) as LegStatusView;
const status = (legs: LegStatusView[], extra: Partial<RowStatus> = {}): RowStatus => ({
  legs,
  risks: [],
  dimmed: false,
  canceled: false,
  spoken: [],
  ...extra,
});
const delayed = (m: number) => view({ kind: 'delayed', label: `Delayed ${m}m`, spoken: '' });
const canceled = view({ kind: 'canceled', label: 'Canceled', spoken: '' });

describe('route card headline (round 66, John picked A)', () => {
  it('is null with nothing live wrong, so the chance word leads', () => {
    expect(statusHeadline(two, undefined)).toBeNull();
    expect(statusHeadline(two, status([view(), view()]))).toBeNull();
  });

  it('a canceled flight leads, naming which one on a connection', () => {
    expect(statusHeadline(two, status([delayed(40), canceled]))).toEqual({ label: 'PHX → LAX canceled', tone: 'canceled' });
    expect(statusHeadline(one, status([canceled]))).toEqual({ label: 'Canceled', tone: 'canceled' });
  });

  it('then a connection at risk, then a departed first flight', () => {
    const risks = [{ index: 0, airport: 'PHX', layoverMin: 20, minConnectMin: 60 }];
    expect(statusHeadline(two, status([delayed(40), view()], { risks }))).toEqual({ label: 'Connection at risk at PHX', tone: 'delayed' });
    const gone = view({ kind: 'departed', label: 'Departed', spoken: '' });
    expect(statusHeadline(two, status([gone, view()], { dimmed: true }))).toEqual({ label: 'Departed', tone: 'gone' });
  });

  it('then delays: one names its flight, two or more are counted', () => {
    expect(statusHeadline(two, status([delayed(40), view()]))).toEqual({ label: 'DFW → PHX delayed 40m', tone: 'delayed' });
    expect(statusHeadline(two, status([delayed(40), delayed(25)]))).toEqual({ label: '2 flights delayed', tone: 'delayed' });
    expect(statusHeadline(one, status([delayed(40)]))).toEqual({ label: 'Delayed 40m', tone: 'delayed' });
  });
});
