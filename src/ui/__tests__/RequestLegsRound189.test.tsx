import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import type { Itinerary } from '@/engine';
import { balance, EMPTY_WALLET, hideSeats, lockedKeys, requestCost, requestLegs, welcome } from '@/membership/membership';

import { RequestLoadsCard, type RequestLeg } from '../RequestLoadsCard';

const NOW = Date.UTC(2026, 10, 11, 18);
const words = (n: ReactTestInstance) =>
  n
    .findAll((x) => (x.type as unknown) === 'Text')
    .map((x) =>
      [x.props.children]
        .flat(5)
        .filter((s) => typeof s === 'string' || typeof s === 'number')
        .join(''),
    )
    .join(' ');
const byLabel = (r: ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

const TWO: RequestLeg[] = [
  { from: 'DAL', to: 'DEN', departText: '11:40 AM', locked: true },
  { from: 'DEN', to: 'LAX', departText: '2:50 PM', locked: true },
];

describe('request loads per leg (round 189, John: "1 credit per leg. Not route.")', () => {
  it('charges a credit for each leg not already requested', () => {
    let w = welcome(EMPTY_WALLET, 'free', NOW); // 3 credits
    expect(requestCost(w, ['A', 'B'])).toBe(2);
    w = requestLegs(w, ['A'], 'Requested DAL to DEN', NOW).wallet;
    expect(balance(w)).toBe(2);
    expect(lockedKeys(w, ['A', 'B'])).toEqual(['B']);
    expect(requestCost(w, ['A', 'B'])).toBe(1);
    // Requesting the whole route now only charges the leg still hidden.
    const all = requestLegs(w, ['A', 'B'], 'Requested DAL to DEN to LAX', NOW + 1);
    expect(all.outcome).toBe('requested');
    expect(balance(all.wallet)).toBe(1);
    expect(all.wallet.entries[0].delta).toBe(-1);
    expect(requestLegs(all.wallet, ['A', 'B'], 'Again', NOW + 2).outcome).toBe('already');
  });

  it('refuses when there are not enough credits for every picked leg', () => {
    const w = requestLegs(welcome(EMPTY_WALLET, 'free', NOW), ['A', 'B'], 'x', NOW).wallet; // 1 left
    expect(requestLegs(w, ['C', 'D'], 'y', NOW).outcome).toBe('short');
    expect(requestLegs(w, ['C'], 'y', NOW).outcome).toBe('requested');
  });

  it('hides only the legs that were not requested', () => {
    const seats = { source: 'reported', tier: 'wide', netSeats: 20, openSeats: 22, listed: 2, asOf: NOW };
    const it = {
      id: 'x',
      origin: 'DAL',
      legs: [
        { flight: {}, seats },
        { flight: {}, seats },
      ],
    } as unknown as Itinerary;
    const view = hideSeats(it, (i) => i === 0);
    expect(view.legs[0].seats.netSeats).toBe(20);
    expect(view.legs[1].seats.netSeats).toBeNull();
  });

  it('shows each leg with a 1 credit quick request and an all-legs button with its cost', () => {
    const onRequest = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<RequestLoadsCard tier="free" credits={2} legs={TWO} onRequest={onRequest} onAnswerLoads={jest.fn()} />);
    });
    const all = words(r.root);
    expect(all).toContain('1 credit per leg');
    expect(all).toContain('DAL');
    expect(all).toContain('2:50 PM');
    expect(all).toContain('Request All Legs, 2 credits');
    act(() => byLabel(r, 'Request DEN to LAX loads, 1 credit')[0].props.onPress());
    expect(onRequest).toHaveBeenLastCalledWith([1]);
    act(() => byLabel(r, 'Request All Legs, 2 credits')[0].props.onPress());
    expect(onRequest).toHaveBeenLastCalledWith([0, 1]);
  });

  it('a requested leg says so, and the all button goes once one leg is left', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <RequestLoadsCard
          tier="free"
          credits={2}
          legs={[TWO[0], { ...TWO[1], locked: false }]}
          onRequest={jest.fn()}
          onAnswerLoads={jest.fn()}
        />,
      );
    });
    expect(words(r.root)).toContain('Requested');
    expect(byLabel(r, 'Request DAL to DEN loads, 1 credit').length).toBeGreaterThan(0);
    expect(byLabel(r, 'Request DEN to LAX loads, 1 credit')).toHaveLength(0);
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'DEN to LAX loads requested').length).toBeGreaterThan(0);
    expect(words(r.root)).not.toContain('Request All Legs');
  });

  it('with credits for only some legs, says how many and offers legs one at a time', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<RequestLoadsCard tier="payg" credits={1} legs={TWO} onRequest={jest.fn()} onAnswerLoads={jest.fn()} />);
    });
    expect(words(r.root)).toContain('You have 1, enough for 1 leg.');
    expect(words(r.root)).not.toContain('Request All Legs');
    expect(byLabel(r, 'Request DAL to DEN loads, 1 credit')[0].props.disabled).toBeFalsy();
  });

  it('out of credits points to answering loads', () => {
    const onAnswer = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<RequestLoadsCard tier="free" credits={0} legs={TWO} onRequest={jest.fn()} onAnswerLoads={onAnswer} />);
    });
    expect(words(r.root)).toContain('out of credits');
    act(() => byLabel(r, 'Answer Loads')[0].props.onPress());
    expect(onAnswer).toHaveBeenCalled();
  });
});
