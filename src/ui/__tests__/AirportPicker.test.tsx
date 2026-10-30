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
    expect(labels[0]).toBe('DFW, Dallas/Fort Worth, Nearest');
    expect(labels[1]).toBe('DAL, Dallas Love Field, Main home');
    const dal = rows().find((n) => n.props.accessibilityLabel.startsWith('DAL, Dallas Love Field, Main'))!;
    expect(dal.props.accessibilityState).toEqual({ selected: true });
    act(() => dal.props.onPress());
    expect(onPick).toHaveBeenCalledWith('DAL');
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

