/** Round 224: a picked country, state or city on the From/To card and in the results' wording. */
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { PlaceRef, SearchRequest } from '@/engine';

import { areaCallouts, areaLines } from '../ResultsPanel';
import { AirportCard } from '../SearchPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPAIN: PlaceRef = { key: 'country:ES', name: 'Spain', airports: ['BCN', 'MAD'] };
const US: PlaceRef = { key: 'country:US', name: 'United States', airports: ['ATL', 'AUS', 'BNA', 'CLT', 'DAL', 'DEN', 'DFW'] };

describe('a picked place (round 224)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it("shows the place's name big, its airports under it, and no area pill", () => {
    act(() => {
      r = create(<AirportCard label="To" code="BCN" group={SPAIN} onPress={jest.fn()} areaOn={false} onToggleArea={jest.fn()} />);
    });
    const lines = r!.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
    expect(lines).toContain('Spain');
    expect(lines).toContain('BCN, MAD');
    expect(lines).not.toContain('BCN');
    const big = r!.root.find((n) => n.props.testID === 'card-place' && n.props.numberOfLines === 1);
    expect(big.props.adjustsFontSizeToFit).toBe(true);
    expect(r!.root.findAll((n) => n.props.accessibilityRole === 'switch')).toHaveLength(0);
    const card = r!.root.find((n) => n.props.accessibilityRole === 'button' && /^To:/.test(n.props.accessibilityLabel ?? ''));
    expect(card.props.accessibilityLabel).toBe('To: all of Spain, BCN and MAD. Change');
  });

  it('says where a place search leaves from or lands, with codes while they fit one line', () => {
    const request: SearchRequest = {
      origin: 'ATL',
      destination: 'BCN',
      date: '2026-11-18',
      originGroup: US,
      destinationGroup: SPAIN,
    };
    expect(areaLines(request)).toEqual([
      'Leaving from anywhere in the United States (7 airports)',
      'Landing at anywhere in Spain (BCN, MAD)',
    ]);
    // Seven codes would wrap, so only Spain gets the callout.
    expect(areaCallouts(request)).toEqual([{ from: false, codes: ['BCN', 'MAD'] }]);
  });
});
