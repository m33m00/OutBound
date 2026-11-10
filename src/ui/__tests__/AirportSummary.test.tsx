import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AIRPORT_INFO, airportInfo, checkedText } from '@/airports/airportInfo';
import { AIRPORTS } from '@/engine';

import { AirportSummaryProvider, AirportSummarySheet, useAirportHold } from '../AirportSummary';

const text = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) =>
      [n.props.children]
        .flat(5)
        .filter((x) => typeof x === 'string')
        .join(''),
    )
    .join('\n');

describe('airport summary (round 174)', () => {
  it('has checked facts for every airport in the table, nothing invented', () => {
    for (const code of Object.keys(AIRPORTS)) {
      const info = airportInfo(code);
      expect(info).not.toBeNull();
      expect(info!.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(airportInfo('ZZZ')).toBeNull();
    for (const info of Object.values(AIRPORT_INFO)) {
      for (const t of [...(info.transit ?? []).flatMap((x) => [x.name, x.detail]), info.hours, info.rentalCars]) {
        if (t) expect(t).not.toMatch(/[·~]/);
      }
    }
    expect(checkedText('2026-11-07')).toBe('Nov 7, 2026');
  });

  it('shows transit, hours and rental cars, and says when a fact could not be confirmed', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<AirportSummarySheet code="DFW" onClose={() => {}} now={Date.UTC(2026, 10, 7, 18, 0)} />);
    });
    const all = text(r);
    expect(all).toContain('DART Orange Line');
    expect(all).toContain('TEXRail');
    expect(all).toContain('Rental Car Center');
    expect(all).toContain('Couldn’t confirm this one yet');
    expect(all).toMatch(/checked Nov 7, 2026/);
    expect(all).toMatch(/Local time \d{1,2}:\d{2}\s?[AP]M/);
  });

  it('opens from holding an airport inside the provider', () => {
    let hold: ReturnType<typeof useAirportHold> = {};
    function Pill() {
      hold = useAirportHold('SEA');
      return <Text>SEA</Text>;
    }
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <AirportSummaryProvider>
          <Pill />
        </AirportSummaryProvider>,
      );
    });
    expect(r.root.findAll((n) => n.props.testID === 'airport-summary')).toHaveLength(0);
    act(() => hold.onLongPress?.());
    expect(text(r)).toContain('Sound Transit 1 Line');
  });

  it('does nothing outside a provider or for an unknown airport', () => {
    let hold: { onLongPress?: () => void } = { onLongPress: () => {} };
    function Pill({ code }: { code: string }) {
      hold = useAirportHold(code);
      return null;
    }
    act(() => {
      create(<Pill code="SEA" />);
    });
    expect(hold.onLongPress).toBeUndefined();
    act(() => {
      create(
        <AirportSummaryProvider>
          <Pill code="ZZZ" />
        </AirportSummaryProvider>,
      );
    });
    expect(hold.onLongPress).toBeUndefined();
  });
});
