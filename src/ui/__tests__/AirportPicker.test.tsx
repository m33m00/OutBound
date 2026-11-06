import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AirportPicker } from '../AirportPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AirportPicker (design round 3)', () => {
  let r: ReactTestRenderer | undefined;
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
    expect(labels[0]).toBe('DFW, Dallas/Fort Worth, Dallas, TX, Nearest');
    expect(labels[1]).toBe('DAL, Dallas Love Field, Dallas, TX, Main home');
    const dal = rows().find((n) => n.props.accessibilityLabel.startsWith('DAL, Dallas Love Field, Dallas, TX, Main'))!;
    expect(dal.props.accessibilityState).toEqual({ selected: true });
    act(() => dal.props.onPress());
    expect(onPick).toHaveBeenCalledWith('DAL');
  });

  it('draws each section as one rounded card with the code in a pill and the city under the name (round 163)', () => {
    act(() => {
      r = create(
        <AirportPicker
          visible
          title="To"
          nearest="DFW"
          homes={[{ code: 'DAL', main: true }]}
          onPick={jest.fn()}
          onClose={jest.fn()}
        />,
      );
    });
    const flat = (st: unknown) => Object.assign({}, ...[st].flat(5).filter(Boolean));
    const quick = rows().slice(0, 2);
    const style = (n: (typeof quick)[0]) =>
      flat(typeof n.props.style === 'function' ? n.props.style({ pressed: false }) : n.props.style);
    expect(style(quick[0]).borderTopLeftRadius).toBeGreaterThan(0);
    expect(style(quick[0]).borderBottomLeftRadius).toBeUndefined();
    expect(style(quick[1]).borderBottomLeftRadius).toBeGreaterThan(0);
    expect(style(quick[1]).borderTopLeftRadius).toBeUndefined();
    const hosts = (n: (typeof quick)[0], id: string) => n.findAll((x) => typeof x.type === 'string' && x.props.testID === id);
    expect(hosts(quick[0], 'airport-code-pill')).toHaveLength(1);
    const place = hosts(quick[0], 'airport-place')[0];
    expect([place.props.children].flat().join('')).toBe('Dallas, TX');
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
