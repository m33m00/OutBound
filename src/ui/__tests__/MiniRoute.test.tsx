import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

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
});
