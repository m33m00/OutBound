import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Flight } from '@/engine';
import type { LoadAnswer } from '@/requests/requests';

import { AtAirportCard } from '../AtAirportCard';
import { DeparturesSheet } from '../DeparturesSheet';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 30, 15);
const flight = (n: number, minutes: number): Flight => ({
  id: `F${n}`,
  airline: 'WN',
  flightNumber: String(100 + n),
  from: 'DAL',
  to: 'HOU',
  departUtc: NOW + minutes * 60_000,
  arriveUtc: NOW + (minutes + 60) * 60_000,
});

describe('at-airport card and departures (round 33)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const texts = () =>
    r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);

  it('card asks if you are at the airport and opens the board; no button with no departures', async () => {
    const onReport = jest.fn();
    await act(async () => {
      r = create(<AtAirportCard code="DAL" upcoming={3} onBoard={4} onReport={onReport} />);
    });
    expect(texts()).toContain('At DAL? Report a load');
    // The count is flights still to leave, not ones that already went.
    expect(texts()).toContain('3 departures in the next 5 hours. Pick yours from the board.');
    act(() => r!.root.find((n) => n.props.accessibilityLabel === 'Report a load at DAL' && n.props.onPress).props.onPress());
    expect(onReport).toHaveBeenCalled();
    act(() => r!.update(<AtAirportCard code="DAL" upcoming={0} onBoard={0} onReport={onReport} />));
    expect(r!.root.findAll((n) => n.props.accessibilityLabel === 'Report a load at DAL')).toHaveLength(0);
  });

  it('pick a flight, report in the same sheet, and the row shows your report', async () => {
    const reports: Record<string, LoadAnswer> = {};
    const onReport = jest.fn((f: Flight, open: number, listed: number) => {
      reports[f.id] = { open, listed, at: NOW, byYou: true };
    });
    const props = {
      code: 'DAL',
      flights: [flight(1, 40), flight(2, -10)],
      now: NOW,
      reportFor: (f: Flight) => reports[f.id] ?? null,
      onReport,
      onClose: jest.fn(),
    };
    await act(async () => {
      r = create(<DeparturesSheet {...props} />);
    });
    expect(texts()).toContain('Departures from DAL');
    const rows = r!.root.findAll((n) => n.props.testID === 'departure-row' && n.props.onPress);
    expect(rows).toHaveLength(2);
    expect(rows[1].props.accessibilityLabel).toMatch(/^Left /);
    // Left shows in words too, not only as a muted time.
    expect(texts().some((t) => t.startsWith('Left · '))).toBe(true);
    act(() => rows[0].props.onPress());
    expect(texts()).toContain('Report Load');
    const box = r!.root.find((n) => n.props.accessibilityLabel === 'Open seats, On the board' && n.props.onChangeText);
    act(() => box.props.onChangeText('9'));
    act(() => r!.root.find((n) => typeof n.type !== 'string' && n.props.accessibilityLabel === 'Submit Report' && n.props.onPress).props.onPress());
    expect(onReport).toHaveBeenCalledWith(props.flights[0], 9, 0);
    act(() => r!.update(<DeparturesSheet {...props} />));
    const row = r!.root.findAll((n) => n.props.testID === 'departure-row' && n.props.onPress)[0];
    expect(row.props.accessibilityLabel).toContain('You reported');
    expect(row.props.accessibilityHint).toBe('Opens Report Load again');
  });

  it('an empty board says so', async () => {
    await act(async () => {
      r = create(<DeparturesSheet code="DAL" flights={[]} now={NOW} reportFor={() => null} onReport={jest.fn()} onClose={jest.fn()} />);
    });
    expect(texts()).toContain('No more departures from DAL in the next 5 hours.');
  });
});
