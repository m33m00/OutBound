import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { zonedToUtc, type Flight } from '@/engine';
import { LOGBOOK_KEY, type LoggedFlight } from '@/logbook/logbook';
import { LogbookProvider } from '@/logbook/LogbookProvider';

import { LogFlightLink } from '../LogFlightLink';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Leaves DFW at 11:30 PM local, so its day is the 30th though it's the 31st in UTC.
const depart = zonedToUtc('2026-10-30', '23:30', 'America/Chicago');
const flight: Flight = { id: 'x', airline: 'AA', flightNumber: '88', from: 'DFW', to: 'LAX', departUtc: depart, arriveUtc: depart + 3 * 3600_000 };

describe('LogFlightLink', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => AsyncStorage.clear());
  afterEach(() => act(() => r?.unmount()));

  const mount = async (now: number, withLogbook = true) => {
    const link = <LogFlightLink flight={flight} now={now} />;
    await act(async () => {
      r = create(withLogbook ? <LogbookProvider>{link}</LogbookProvider> : link);
    });
  };
  const byId = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type !== 'string');

  it('waits until two hours before departure', async () => {
    await mount(depart - 3 * 3600_000);
    expect(byId('log-flight')).toHaveLength(0);
  });

  it('shows nothing without a logbook', async () => {
    await mount(depart, false);
    expect(r!.toJSON()).toBeNull();
  });

  it('logs the flight on its local day, then says it’s there', async () => {
    await mount(depart - 3600_000);
    await act(async () => byId('log-flight')[0].props.onPress());
    const stored = JSON.parse((await AsyncStorage.getItem(LOGBOOK_KEY)) ?? '[]') as LoggedFlight[];
    expect(stored.map((f) => f.id)).toEqual(['2026-10-30|AA88:DFW-LAX']);
    expect(byId('log-flight')).toHaveLength(0);
    expect(byId('log-flight-done')[0].props.accessibilityLabel).toBe('In your Logbook');
  });
});
