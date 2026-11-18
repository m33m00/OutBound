/** Round 224: browse From and To by country, state and city, and pick a whole place. */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { resetRecentAirportsForTests, useRecentAirports } from '@/search/recentAirports';

import { AirportPicker } from '../AirportPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const text = (n: { props: { children?: unknown } }) => [n.props.children].flat().join('');

describe('AirportPicker places (round 224)', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => resetRecentAirportsForTests());
  afterEach(() => act(() => r?.unmount()));

  const byTest = (id: string) => r!.root.findAll((n) => n.props?.testID === id && n.props.onPress);
  const labels = (id: string) => byTest(id).map((n) => n.props.accessibilityLabel as string);
  const headers = () =>
    r!.root.findAll((n) => n.props.accessibilityRole === 'header' && (n.type as unknown) === 'Text').map(text);
  const press = (id: string, starts: string) =>
    act(() =>
      byTest(id)
        .find((n) => (n.props.accessibilityLabel as string).startsWith(starts))!
        .props.onPress(),
    );

  const mount = (props: Partial<React.ComponentProps<typeof AirportPicker>> = {}) => {
    const onPick = jest.fn();
    const onPickGroup = jest.fn();
    act(() => {
      r = create(<AirportPicker visible title="To" onPick={onPick} onPickGroup={onPickGroup} onClose={jest.fn()} {...props} />);
    });
    return { onPick, onPickGroup };
  };

  it('lists countries under All airports, the United States first', () => {
    mount();
    expect(headers()).toEqual(['To', 'ALL AIRPORTS']);
    expect(labels('place-row').map((l) => l.split(',')[0])).toEqual([
      'United States',
      'Canada',
      'Japan',
      'Mexico',
      'Spain',
      'United Kingdom',
    ]);
    expect(labels('place-row')[4]).toBe('Spain, BCN, MAD');
  });

  it('opens a country to its states, a state to its cities, with All of at the top and a way back', () => {
    const { onPick, onPickGroup } = mount();
    press('place-row', 'United States');
    expect(headers()).toEqual(['To', 'UNITED STATES']);
    expect(labels('place-all')[0]).toMatch(/^All of the United States, \d+ airports$/);
    press('place-row', 'Texas');
    expect(headers()).toEqual(['To', 'TEXAS']);
    expect(labels('place-back')).toEqual(['Back to United States']);
    expect(labels('place-all')).toEqual(['All of Texas, AUS, DAL, DFW, HOU, IAH']);
    // A city with one airport is that airport; Dallas opens to its two.
    expect(labels('airport-row').map((l) => l.slice(0, 3))).toEqual(['AUS']);
    press('place-row', 'Dallas');
    expect(labels('airport-row').map((l) => l.slice(0, 3))).toEqual(['DAL', 'DFW']);
    press('place-back', 'Back to Texas');
    press('place-all', 'All of Texas');
    expect(onPickGroup).toHaveBeenCalledWith({
      key: 'region:US-TX',
      name: 'Texas',
      airports: ['AUS', 'DAL', 'DFW', 'HOU', 'IAH'],
    });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('a state with one airport picks it straight away, and is remembered like any airport', async () => {
    let recent: readonly string[] = [];
    function Peek() {
      recent = useRecentAirports();
      return null;
    }
    const onPick = jest.fn();
    act(() => {
      r = create(
        <>
          <AirportPicker visible title="To" onPick={onPick} onPickGroup={jest.fn()} onClose={jest.fn()} />
          <Peek />
        </>,
      );
    });
    press('place-row', 'United States');
    await act(async () => {
      byTest('place-row')
        .find((n) => (n.props.accessibilityLabel as string).startsWith('Arizona'))!
        .props.onPress();
    });
    expect(onPick).toHaveBeenCalledWith('PHX');
    expect(recent[0]).toBe('PHX');
  });

  it('finds places as you type, then the airports in them', () => {
    const { onPickGroup } = mount();
    const input = r!.root.find((n) => n.props.accessibilityLabel === 'Search airports' && n.props.onChangeText);
    expect(input.props.placeholder).toBe('Airport, city, state or country');
    act(() => input.props.onChangeText('Spain'));
    expect(labels('place-row')).toEqual(['Spain, BCN, MAD']);
    expect(labels('airport-row').map((l) => l.slice(0, 3))).toEqual(['BCN', 'MAD']);
    // Return still picks an airport, never a whole place.
    expect(input.props.returnKeyType).toBe('go');
    press('place-row', 'Spain');
    expect(headers()).toEqual(['To', 'SPAIN']);
    press('place-all', 'All of Spain');
    expect(onPickGroup).toHaveBeenCalledWith(expect.objectContaining({ key: 'country:ES', name: 'Spain' }));
  });

  it("opens where the picked place sits, with its check, and leaves out the other end's airports", () => {
    mount({ currentGroup: 'country:ES', exclude: ['MAD'] });
    expect(headers()).toEqual(['To', 'ALL AIRPORTS']);
    act(() =>
      r!.update(<AirportPicker visible={false} title="To" onPick={jest.fn()} onPickGroup={jest.fn()} onClose={jest.fn()} />),
    );
    act(() =>
      r!.update(
        <AirportPicker
          visible
          title="To"
          currentGroup="city:US-TX-Dallas"
          onPick={jest.fn()}
          onPickGroup={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );
    expect(headers()).toEqual(['To', 'TEXAS']);
    act(() =>
      byTest('place-row')
        .find((n) => n.props.accessibilityLabel.startsWith('Dallas'))!
        .props.onPress(),
    );
    expect(byTest('place-all')[0].props.accessibilityState).toEqual({ selected: true });
  });

  it('without places, the picker is airports only, as before', () => {
    act(() => {
      r = create(<AirportPicker visible title="To" onPick={jest.fn()} onClose={jest.fn()} />);
    });
    expect(byTest('place-row')).toHaveLength(0);
    expect(byTest('airport-row').length).toBeGreaterThan(0);
  });
});
