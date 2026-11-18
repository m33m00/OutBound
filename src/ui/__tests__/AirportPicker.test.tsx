import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { colors } from '@/theme';

import { resetRecentAirportsForTests } from '@/search/recentAirports';

import { AirportPicker } from '../AirportPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AirportPicker (design round 3)', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => resetRecentAirportsForTests());
  afterEach(() => act(() => r?.unmount()));

  const rows = () =>
    r!.root.findAll(
      (n) => n.props.accessibilityRole === 'button' && n.props.onPress && /^[A-Z]{3}, /.test(n.props.accessibilityLabel ?? ''),
    );

  it('shows your airports first, tagged, and checks the current one', () => {
    const onPick = jest.fn();
    act(() => {
      r = create(
        <AirportPicker
          visible
          title="From"
          current="DAL"
          nearest="DFW"
          homes={[{ code: 'DAL', main: true }]}
          onPick={onPick}
          onClose={jest.fn()}
        />,
      );
    });
    const labels = rows().map((n) => n.props.accessibilityLabel);
    expect(labels[0]).toBe('DFW, DFW International, Dallas, TX, Nearest');
    expect(labels[1]).toBe('DAL, Love Field, Dallas, TX, Main home');
    const dal = rows().find((n) => n.props.accessibilityLabel.startsWith('DAL, Love Field, Dallas, TX, Main'))!;
    expect(dal.props.accessibilityState).toEqual({ selected: true });
    act(() => dal.props.onPress());
    expect(onPick).toHaveBeenCalledWith('DAL');
  });

  // Round 214 (John, on the To picker): "Fix all of them", then the big "To" "feels plain and almost touching
  // the corner".
  it('lists plain rows with a blue code, the airport name over its city, under a heading, in a centered header', () => {
    act(() => {
      r = create(<AirportPicker visible title="To" exclude={['DAL', 'DFW']} onPick={jest.fn()} onClose={jest.fn()} />);
    });
    const flat = (st: unknown) => Object.assign({}, ...[st].flat(5).filter(Boolean));
    const atl = rows()[0];
    const style = flat(typeof atl.props.style === 'function' ? atl.props.style({ pressed: false }) : atl.props.style);
    expect(style.borderWidth ?? style.borderTopWidth ?? 0).toBe(0);
    expect(style.backgroundColor).toBeUndefined();
    const hosts = (id: string) => atl.findAll((x) => typeof x.type === 'string' && x.props.testID === id);
    expect(hosts('airport-code-pill')).toHaveLength(0);
    expect(flat(hosts('airport-code')[0].props.style).color).toBe(colors.light.accent);
    const lines = atl.findAll((x) => (x.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
    expect(lines).toEqual(['ATL', 'Hartsfield-Jackson', 'Atlanta, GA']);
    const headers = r!.root.findAll((n) => n.props.accessibilityRole === 'header' && (n.type as unknown) === 'Text');
    expect(headers.map((n) => [n.props.children].flat().join(''))).toEqual(['To', 'ALL AIRPORTS']);
    expect(r!.root.findAll((n) => n.props.testID === 'sheet-grabber' && typeof n.type === 'string')).toHaveLength(1);
    expect(flat(headers[0].props.style).textAlign).toBe('center');
  });

  it('puts your last picks first, under Recent', async () => {
    act(() => {
      r = create(<AirportPicker visible title="To" onPick={jest.fn()} onClose={jest.fn()} />);
    });
    // 30 airports since round 224, so find it by typing rather than scrolling.
    const input = r!.root.find((n) => n.props.accessibilityLabel === 'Search airports' && n.props.onChangeText);
    act(() => input.props.onChangeText('LAX'));
    await act(async () => {
      rows()
        .find((n) => n.props.accessibilityLabel.startsWith('LAX'))!
        .props.onPress();
    });
    const labels = rows().map((n) => n.props.accessibilityLabel.slice(0, 3));
    expect(labels[0]).toBe('LAX');
    const headers = r!.root.findAll((n) => n.props.accessibilityRole === 'header' && (n.type as unknown) === 'Text');
    expect(headers.map((n) => [n.props.children].flat().join(''))).toEqual(['To', 'RECENT', 'ALL AIRPORTS']);
  });

  it('finds airports by city too (round 163)', () => {
    act(() => {
      r = create(<AirportPicker visible title="To" onPick={jest.fn()} onClose={jest.fn()} />);
    });
    const input = r!.root.find((n) => n.props.accessibilityLabel === 'Search airports' && n.props.onChangeText);
    act(() => input.props.onChangeText('Nashville'));
    expect(rows().map((n) => n.props.accessibilityLabel.slice(0, 3))).toEqual(['BNA']);
  });

  it('says so when nothing matches', () => {
    act(() => {
      r = create(<AirportPicker visible title="To" onPick={jest.fn()} onClose={jest.fn()} />);
    });
    const input = r!.root.find((n) => n.props.accessibilityLabel === 'Search airports' && n.props.onChangeText);
    act(() => input.props.onChangeText('zzz'));
    expect(rows()).toHaveLength(0);
    const texts = r!.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
    expect(texts.some((t) => t.includes('No airports match'))).toBe(true);
  });

  it('picks the top match on Return once something is typed, with a tick (design round 29)', () => {
    const onPick = jest.fn();
    act(() => {
      r = create(<AirportPicker visible title="To" onPick={onPick} onClose={jest.fn()} />);
    });
    const input = () => r!.root.find((n) => n.props.accessibilityLabel === 'Search airports' && n.props.onChangeText);
    expect(input().props.returnKeyType).toBe('done');
    act(() => input().props.onSubmitEditing());
    expect(onPick).not.toHaveBeenCalled();
    act(() => input().props.onChangeText('LAX'));
    expect(input().props.returnKeyType).toBe('go');
    act(() => input().props.onSubmitEditing());
    expect(onPick).toHaveBeenCalledWith('LAX');
  });
});
