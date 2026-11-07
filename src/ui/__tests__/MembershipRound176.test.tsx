import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { EMPTY_WALLET, requestRoute, welcome } from '@/membership/membership';
import { MembershipProvider, useMembership } from '@/membership/MembershipProvider';
import { addAnsweredAsk } from '@/requests/requests';
import { RequestsProvider, useRequests } from '@/requests/RequestsProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';
import type { Flight } from '@/engine';

import { CreditsChip, CreditsSheet } from '../Credits';
import { DEFAULT_FILTERS } from '@/settings/settings';
import { FiltersForm } from '../FiltersForm';
import { PlanPicker } from '../PlanPicker';
import { RequestLoadsCard } from '../RequestLoadsCard';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = Date.UTC(2026, 10, 7, 18);
const words = (n: ReactTestInstance) =>
  n
    .findAll((x) => (x.type as unknown) === 'Text')
    .map((x) =>
      [x.props.children]
        .flat(5)
        .filter((s) => typeof s === 'string' || typeof s === 'number')
        .join(''),
    );
const press = (r: ReactTestRenderer, id: string) =>
  act(() => r.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0].props.onPress());

describe('plans and credits (round 176)', () => {
  it('picker: Continue waits for a pick, then hands it back', () => {
    const onPick = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<PlanPicker visible onPick={onPick} onLater={jest.fn()} />);
    });
    const all = words(r.root).join('\n');
    expect(all).toContain('Free');
    expect(all).toContain('Pay as you go');
    expect(all).toContain('Premium');
    expect(all).toContain('nothing is charged');
    const cont = () =>
      r.root.findAll((n) => n.props.accessibilityLabel === 'Continue' && typeof n.props.onPress === 'function')[0];
    expect(cont().props.disabled).toBe(true);
    press(r, 'plan-payg');
    expect(cont().props.disabled).toBeFalsy();
    act(() => cont().props.onPress());
    expect(onPick).toHaveBeenCalledWith('payg');
    // The title's VoiceOver focus waits a moment; unmount so it doesn't fire after the test.
    act(() => r.unmount());
  });

  it('request card: spends a credit when there is one, points to answering loads when not', () => {
    const onRequest = jest.fn();
    const onAnswer = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<RequestLoadsCard tier="free" credits={2} onRequest={onRequest} onAnswerLoads={onAnswer} />);
    });
    expect(words(r.root).join(' ')).toContain('request this route’s loads for 1 credit');
    act(() => r.root.findAll((n) => n.props.accessibilityLabel === 'Request Loads' && n.props.onPress)[0].props.onPress());
    expect(onRequest).toHaveBeenCalled();
    act(() => r.update(<RequestLoadsCard tier="free" credits={0} onRequest={onRequest} onAnswerLoads={onAnswer} />));
    expect(words(r.root).join(' ')).toContain('out of credits');
    act(() => r.root.findAll((n) => n.props.accessibilityLabel === 'Answer Loads' && n.props.onPress)[0].props.onPress());
    expect(onAnswer).toHaveBeenCalled();
  });

  it('credits sheet: balance, earned, spent and recent entries', () => {
    const w = requestRoute(welcome(EMPTY_WALLET, 'free', NOW), ['A'], 'Requested DAL to LAX', NOW).wallet;
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<CreditsSheet visible tier="free" wallet={w} onClose={jest.fn()} onAnswerLoads={jest.fn()} now={NOW} />);
    });
    const at = (id: string) => words(r.root.find((n) => n.props.testID === id && (n.type as unknown) === 'Text')).join('');
    expect(at('credits-balance')).toBe('2');
    expect(at('credits-earned')).toBe('0');
    expect(at('credits-spent')).toBe('1');
    const all = words(r.root).join('\n');
    expect(all).toContain('Requested DAL to LAX');
    expect(all).toContain('Free plan');
  });

  it('answering a load earns a credit on Free, once per flight; Premium counts nothing', async () => {
    await AsyncStorage.setItem('outbound.settings.v1', JSON.stringify({ membership: 'free' }));
    let m!: ReturnType<typeof useMembership>;
    let q!: ReturnType<typeof useRequests>;
    const Probe = () => {
      m = useMembership();
      q = useRequests();
      return null;
    };
    await act(async () => {
      create(
        <SettingsProvider>
          <MembershipProvider>
            <RequestsProvider>
              <Probe />
            </RequestsProvider>
          </MembershipProvider>
        </SettingsProvider>,
      );
    });
    expect(m.tier).toBe('free');
    expect(m.credits).toBe(3);
    const flight = {
      airline: 'WN',
      flightNumber: '12',
      from: 'DAL',
      to: 'HOU',
      departUtc: NOW,
      arriveUtc: NOW + 3_600_000,
    } as Flight;
    act(() => q.report(flight, 10, 2));
    act(() => q.report(flight, 11, 2));
    expect(m.credits).toBe(4);
    await act(async () => m.setTier('premium'));
    expect(m.tracksCredits).toBe(false);
    act(() => q.report({ ...flight, flightNumber: '13' }, 10, 2));
    expect(m.credits).toBe(4);
  });

  it('the credits chip says credits in words, and Premium has none (round 177, John)', async () => {
    await AsyncStorage.setItem('outbound.settings.v1', JSON.stringify({ membership: 'free' }));
    await AsyncStorage.removeItem('outbound.wallet.v1');
    let m!: ReturnType<typeof useMembership>;
    const Probe = () => {
      m = useMembership();
      return null;
    };
    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(
        <SettingsProvider>
          <MembershipProvider>
            <Probe />
            <CreditsChip onAnswerLoads={jest.fn()} />
          </MembershipProvider>
        </SettingsProvider>,
      );
    });
    const count = r.root.find((n) => n.props.testID === 'credits-chip-count' && (n.type as unknown) === 'Text');
    expect(words(count).join('')).toBe('3 credits');
    await act(async () => m.setTier('premium'));
    expect(r.root.findAll((n) => n.props.testID === 'credits-chip')).toHaveLength(0);
  });

  it('a requested flight lands in My Trips already answered', () => {
    const flight = {
      airline: 'AA',
      flightNumber: '1',
      from: 'DFW',
      to: 'LAX',
      departUtc: NOW + 1e7,
      arriveUtc: NOW + 2e7,
    } as Flight;
    const list = addAnsweredAsk([], flight, { open: 12, listed: 3, at: NOW });
    expect(list).toHaveLength(1);
    expect(list[0].answer).toEqual({ open: 12, listed: 3, at: NOW });
    expect(addAnsweredAsk(list, flight, { open: 1, listed: 1, at: NOW })).toEqual(list);
  });

  it('the time filter is called Departure Time (John)', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<FiltersForm filters={DEFAULT_FILTERS} onChange={jest.fn()} />);
    });
    const all = words(r.root);
    expect(all).toContain('Departure Time');
    expect(all).not.toContain('Time of day');
  });
});
