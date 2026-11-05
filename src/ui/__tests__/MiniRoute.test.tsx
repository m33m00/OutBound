import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Icon } from '../Icon';
import { MiniRoute } from '../MiniRoute';

describe('MiniRoute (round 119)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const texts = () =>
    r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);

  it('puts the ends big and each stop code under its own dot (round 140)', () => {
    act(() => {
      r = create(<MiniRoute airports={['DFW', 'ORD', 'LAX']} />);
    });
    expect(texts()).toEqual(['DFW', 'ORD', 'LAX']);
    expect(r!.root.findAll((n) => n.props.testID === 'mini-route-stop' && typeof n.type === 'string')).toHaveLength(1);
    // Drawn only: the row's own label says the route.
    const host = r!.root.find((n) => n.props.testID === 'mini-route' && typeof n.type === 'string');
    expect(host.props.accessibilityElementsHidden).toBe(true);
  });

  it('a nonstop is just the two ends', () => {
    act(() => {
      r = create(<MiniRoute airports={['DAL', 'LGA']} />);
    });
    expect(texts()).toEqual(['DAL', 'LGA']);
  });

  it('spaces stops evenly between the ends, each code centred on its dot (round 122)', () => {
    const slots = (airports: string[]) => {
      act(() => {
        r = create(<MiniRoute airports={airports} />);
      });
      return r!.root
        .findAll((n) => n.props.testID === 'mini-route-stop-slot' && typeof n.type === 'string')
        .map((n) => {
          const st = Object.assign({}, ...[n.props.style].flat(3).filter(Boolean));
          expect(st.marginLeft).toBe(-st.width / 2);
          return st.left;
        });
    };
    expect(slots(['DFW', 'SEA', 'LAX'])).toEqual(['50%']);
    const thirds = slots(['DFW', 'PHX', 'SEA', 'LAX']).map((l: string) => Math.round(parseFloat(l)));
    expect(thirds).toEqual([33, 67]);
  });

  it('colors each leg on its own and puts its seat numbers centred above it in the same color (round 140, John)', () => {
    const legs = [
      { color: '#00aa00', text: '#006600', label: '40/2' },
      { color: '#ffaa00', text: '#995500', label: '6/4' },
    ];
    act(() => {
      r = create(<MiniRoute airports={['DFW', 'CLT', 'LGA']} legs={legs} />);
    });
    const flat = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean));
    const host = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
    const segs = host('mini-route-seg').map((n) => flat(n.props.style));
    expect(segs.map((st) => st.backgroundColor)).toEqual(['#00aa00', '#ffaa00']);
    expect(segs.map((st) => st.left)).toEqual(['0%', '50%']);
    const labels = host('mini-route-leg-label');
    expect(labels.map((n) => n.props.children)).toEqual(['40/2', '6/4']);
    expect(labels.map((n) => flat(n.props.style).color)).toEqual(['#006600', '#995500']);
    // Each label's slot spans its own leg, so it sits centred between that leg's two dots.
    const slots = host('mini-route-leg-slot').map((n) => flat(n.props.style));
    expect(slots.map((st) => [st.left, st.width])).toEqual([
      ['0%', '50%'],
      ['50%', '50%'],
    ]);
    // Labels never overrun their leg: they shrink to fit on one line.
    expect(labels.every((n) => n.props.numberOfLines === 1 && n.props.adjustsFontSizeToFit)).toBe(true);
  });

  it('draws one plain line with no labels when the legs do not match the stops', () => {
    act(() => {
      r = create(<MiniRoute airports={['DFW', 'CLT', 'LGA']} legs={[{ color: '#0a0', text: '#060', label: '4/1' }]} />);
    });
    expect(r!.root.findAll((n) => n.props.testID === 'mini-route-seg')).toHaveLength(0);
    expect(r!.root.findAll((n) => n.props.testID === 'mini-route-leg-label')).toHaveLength(0);
  });

  it('draws a canceled leg with an X dead centre on its stretch (round 143, John)', () => {
    const legs = [
      { color: '#0a0', text: '#060', label: '15/0' },
      { color: '#c8102e', text: '#9e0d24', label: '', canceled: true },
    ];
    act(() => {
      r = create(<MiniRoute airports={['DAL', 'DEN', 'LAX']} legs={legs} />);
    });
    const xs = r!.root.findAll((n) => n.props.testID === 'mini-route-canceled' && typeof n.type === 'string');
    expect(xs).toHaveLength(1);
    const st = Object.assign({}, ...[xs[0].props.style].flat(3).filter(Boolean));
    expect(st.left).toBe('75%');
    expect(r!.root.findAll((n) => n.props.testID === 'mini-route-leg-label' && typeof n.type === 'string')).toHaveLength(1);
  });

  it('flags a risky connection right on top of its stop, above the seat numbers (round 143, John)', () => {
    const legs = [
      { color: '#0a0', text: '#060', label: '40/2' },
      { color: '#0a0', text: '#060', label: '20/4' },
      { color: '#0a0', text: '#060', label: '9/1' },
    ];
    act(() => {
      r = create(<MiniRoute airports={['DFW', 'CLT', 'MIA', 'LGA']} legs={legs} stopFlags={[null, 'At risk']} />);
    });
    const flat = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean));
    const flags = r!.root.findAll((n) => n.props.testID === 'mini-route-stop-flag' && typeof n.type === 'string');
    expect(flags).toHaveLength(1);
    const flag = flat(flags[0].props.style);
    const stops = r!.root
      .findAll((n) => n.props.testID === 'mini-route-stop-slot' && typeof n.type === 'string')
      .map((n) => flat(n.props.style));
    // Same spot along the line as MIA's dot, and above the seat numbers' row.
    expect(flag.left).toBe(stops[1].left);
    const label = flat(
      r!.root.findAll((n) => n.props.testID === 'mini-route-leg-slot' && typeof n.type === 'string')[0].props.style,
    );
    expect(flag.top + flag.height).toBeLessThanOrEqual(label.top);
  });

  it('shows each flight as its airline logo only; a tap opens its number and aircraft, a tap elsewhere closes it (round 156)', () => {
    const leg = (airline: string, number: string, aircraft?: string) => ({
      color: '#0a0',
      text: '#060',
      label: '9/1',
      flight: { airline, number, aircraft },
    });
    act(() => {
      r = create(<MiniRoute airports={['DFW', 'MIA', 'LGA']} legs={[leg('AA', '100', '737-800'), leg('ZZ', '7')]} />);
    });
    const host = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
    const texts = () =>
      r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children);
    // No number on the line: the known airline is its logo with no tile behind it, an unknown one its code.
    expect(host('flight-peek-logo')).toHaveLength(2);
    expect(texts()).not.toContain('AA 100');
    expect(
      host('flight-peek-logo')[0].findAll((n) => n.props.testID === 'airline-mark' || n.props.testID === 'airline-logo').length,
    ).toBeGreaterThan(0);
    expect(host('flight-peek-logo')[1].findAll((n) => n.props.children === 'ZZ').length).toBeGreaterThan(0);
    expect(host('flight-peek')).toHaveLength(0);
    // Tap the logo: the little window shows the number and the aircraft.
    const press = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function');
    act(() => press('flight-peek-logo')[0].props.onPress());
    expect(host('flight-peek')).toHaveLength(1);
    expect(texts()).toEqual(expect.arrayContaining(['AA 100', '737-800']));
    // A tap anywhere else closes it.
    act(() => press('flight-peek-backdrop')[0].props.onPress());
    expect(host('flight-peek')).toHaveLength(0);
    // Holding works too.
    act(() => press('flight-peek-logo')[1].props.onLongPress());
    expect(texts()).toContain('ZZ 7');
  });

  it("centres a flight's delay over its own leg, above the seat numbers (round 146, John)", () => {
    const leg = (flag?: string) => ({
      color: '#0a0',
      text: '#060',
      label: '21/12',
      flag,
      flight: { airline: 'AA', number: '1' },
    });
    const flags = (airports: string[], legs: ReturnType<typeof leg>[]) => {
      act(() => {
        r = create(<MiniRoute airports={airports} legs={legs} stopFlags={airports.slice(2).map(() => 'At risk')} />);
      });
      return r!.root.findAll((n) => n.props.testID === 'mini-route-leg-flag' && typeof n.type === 'string');
    };
    const two = flags(['DFW', 'MIA', 'LGA'], [leg(), leg('Delayed 50m')]);
    expect(two).toHaveLength(1);
    const slot = StyleSheet.flatten(two[0].props.style);
    // The slot spans the second leg, so the pill centres on it.
    expect(slot).toMatchObject({ left: '50%', width: '50%' });
    const text = two[0].findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')[0];
    expect(text.props.children).toBe('Delayed 50m');
    // Under the line (round 148, John): below the stop codes and right above that leg's flight number,
    // while At risk and the seats stay above the line.
    const host = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
    const topOf = (n: { props: { [k: string]: unknown } }) => StyleSheet.flatten(n.props.style as never).top as number;
    const stopSlot = topOf(host('mini-route-stop-slot')[0]);
    const flights = host('mini-route-flight');
    expect(topOf(two[0])).toBeGreaterThan(stopSlot);
    expect(topOf(flights[1])).toBeGreaterThanOrEqual(topOf(two[0]) + 17);
    expect(topOf(host('mini-route-stop-flag')[0])).toBeLessThan(topOf(host('mini-route-leg-slot')[0]));
    expect(topOf(host('mini-route-leg-slot')[0])).toBeLessThan(stopSlot);
    // On a short leg the delay shortens so it stays inside its own stretch.
    const three = flags(['DFW', 'CLT', 'MIA', 'LGA'], [leg(), leg(), leg('Delayed 50m')]);
    const short = three[0].findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')[0];
    expect(short.props.children).toBe('+50m');
  });

  it('puts a tiny seat icon over the open seats and a person over the listed, in the label color (round 147, John)', () => {
    const counts = [
      { kind: 'seats' as const, value: '21' },
      { kind: 'listed' as const, value: '12' },
    ];
    act(() => {
      r = create(
        <MiniRoute
          airports={['DFW', 'MIA', 'LGA']}
          legs={[
            { color: '#0a0', text: '#060', label: '21/12', counts, flag: 'Delayed 50m' },
            { color: '#999', text: '#666', label: '' },
          ]}
        />,
      );
    });
    const host = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
    expect(host('mini-route-count-value').map((n) => n.props.children)).toEqual(['21', '12']);
    const icons = r!.root.findAll((n) => n.type === Icon);
    expect(icons.map((n) => [n.props.name, n.props.tintColor])).toEqual([
      ['carseat.right.fill', '#060'],
      ['person.fill', '#060'],
    ]);
    // The icons sit above the line and the delay pill under it, so the two never meet.
    const slot = StyleSheet.flatten(host('mini-route-leg-slot')[0].props.style);
    const flag = StyleSheet.flatten(host('mini-route-leg-flag')[0].props.style);
    expect(flag.top as number).toBeGreaterThan(slot.top as number);
  });

  it('puts a red Canceled pill over the X on a canceled leg, so the X explains itself (round 151, John)', () => {
    act(() => {
      r = create(
        <MiniRoute
          airports={['DFW', 'MIA', 'LGA']}
          legs={[
            { color: '#0a0', text: '#060', label: '21/12' },
            { color: '#c00', text: '#900', label: '', canceled: true },
          ]}
        />,
      );
    });
    const host = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
    const pill = host('mini-route-canceled-pill');
    expect(pill).toHaveLength(1);
    expect(StyleSheet.flatten(pill[0].props.style)).toMatchObject({ left: '50%', width: '50%' });
    const word = pill[0].findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')[0];
    expect(word.props.children).toBe('Canceled');
    // Above the line, and the X stays on it.
    expect(StyleSheet.flatten(pill[0].props.style).top as number).toBeLessThan(
      StyleSheet.flatten(host('mini-route-canceled')[0].props.style).top as number,
    );
  });
});
