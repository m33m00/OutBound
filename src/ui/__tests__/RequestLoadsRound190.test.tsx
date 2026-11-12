import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';

import { RequestLoadsBar, requestLabel, requestNote } from '../RequestLoadsBar';
import { ResultRow } from '../ResultRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);
const words = (n: ReactTestInstance): string => n.children.map((ch) => (typeof ch === 'string' ? ch : words(ch))).join(' ');

async function twoLegs() {
  const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
  const provider = createMemoryProvider(
    [
      { id: 'F1', airline: 'AA', flightNumber: '1', from: 'BNA', to: 'DEN', departUtc: at('09:00'), arriveUtc: at('11:00') },
      { id: 'F2', airline: 'AA', flightNumber: '2', from: 'DEN', to: 'LAX', departUtc: at('12:30'), arriveUtc: at('15:00') },
    ],
    {},
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
  return it;
}

describe('request loads from the pass (round 190, John)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('the button names how many legs and what they cost', () => {
    expect(requestLabel(2, 2)).toBe('Request All Legs for 2 credits');
    expect(requestLabel(3, 3)).toBe('Request All Legs for 3 credits');
    expect(requestLabel(1, 1)).toBe('Request Loads for 1 credit');
    expect(requestLabel(1, 2)).toBe('Request 1 Leg for 1 credit');
    expect(requestLabel(2, 3)).toBe('Request 2 Legs for 2 credits');
    expect(requestLabel(0, 2)).toBe('Check a Leg to Request');
  });

  it('the note says the price, and what to do when credits run short', () => {
    expect(requestNote(2, 2)).toBe('Seats are hidden. Loads are 1 credit per leg. You have 2.');
    expect(requestNote(2, 1)).toBe('You have 1 credit, enough for 1 leg. Uncheck the rest.');
    expect(requestNote(1, 0)).toContain('out of credits');
  });

  it('each hidden leg on the pass has a checked credit box that toggles', async () => {
    const it = await twoLegs();
    const onToggle = jest.fn();
    await act(async () => {
      r = create(
        <ResultRow
          itinerary={it}
          selected
          large
          now={NOW}
          onPress={jest.fn()}
          legPicks={{ locked: [true, true], checked: [true, false], onToggle }}
        />,
      );
    });
    const boxes = (i: number) =>
      r!.root.findAll((n) => n.props.testID === `leg-credit-${i}` && n.props.accessibilityRole === 'checkbox');
    expect(boxes(0)[0].props.accessibilityState).toEqual({ checked: true });
    expect(boxes(1)[0].props.accessibilityState).toEqual({ checked: false });
    expect(boxes(0)[0].props.accessibilityLabel).toBe('Request BNA to DEN loads, 1 credit');
    expect(words(r!.root)).toContain('1 credit');
    act(() => boxes(1)[0].props.onPress());
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('a requested leg has no credit box; nothing shows without picks', async () => {
    const it = await twoLegs();
    await act(async () => {
      r = create(
        <ResultRow
          itinerary={it}
          selected
          large
          now={NOW}
          onPress={jest.fn()}
          legPicks={{ locked: [false, true], checked: [true, true], onToggle: jest.fn() }}
        />,
      );
    });
    expect(r!.root.findAll((n) => n.props.testID === 'leg-credit-0')).toHaveLength(0);
    expect(r!.root.findAll((n) => n.props.testID === 'leg-credit-1').length).toBeGreaterThan(0);
    await act(async () => r!.update(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} />));
    expect(r!.root.findAll((n) => n.props.testID === 'leg-credit-1')).toHaveLength(0);
  });

  it('the pinned bar requests the checked legs, and waits when none are checked or credits are short', () => {
    const onRequest = jest.fn();
    const btn = (label: string) =>
      r!.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
    act(() => {
      r = create(<RequestLoadsBar picked={2} locked={2} credits={3} onRequest={onRequest} onAnswerLoads={jest.fn()} />);
    });
    act(() => btn('Request All Legs for 2 credits').props.onPress());
    expect(onRequest).toHaveBeenCalledTimes(1);
    act(() => r!.update(<RequestLoadsBar picked={0} locked={2} credits={3} onRequest={onRequest} onAnswerLoads={jest.fn()} />));
    expect(btn('Check a Leg to Request').props.disabled).toBe(true);
    act(() => r!.update(<RequestLoadsBar picked={2} locked={2} credits={1} onRequest={onRequest} onAnswerLoads={jest.fn()} />));
    expect(btn('Request All Legs for 2 credits').props.disabled).toBe(true);
  });
});

describe('round 191 (John): the note lines up with the button', () => {
  it('centres the line over the request button', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<RequestLoadsBar picked={2} locked={2} credits={3} onRequest={jest.fn()} onAnswerLoads={jest.fn()} />);
    });
    const note = r.root.findAll((n) => n.props.testID === 'request-loads-note' && typeof n.type === 'string')[0];
    const flat = Object.assign({}, ...[note.props.style].flat(3).filter(Boolean));
    expect(flat.textAlign).toBe('center');
    act(() => r.unmount());
  });
});
