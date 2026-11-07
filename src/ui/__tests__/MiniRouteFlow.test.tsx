/**
 * Round 172 (John: "The arch is too much. Not every line also has to be an arch. I just want it to look
 * like it flows nicely"): a connecting route's line is one low wave through its stops; a nonstop stays
 * straight.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { FLOW_AMP, flowPieces, flowSign, MiniRoute, type MiniRouteLeg } from '../MiniRoute';

const leg = (color: string, extra: Partial<MiniRouteLeg> = {}): MiniRouteLeg => ({ color, text: color, label: '40/2', ...extra });
const flat = (st: unknown) => Object.assign({}, ...[st].flat(5).filter(Boolean));

describe('flowPieces', () => {
  it('keeps the line low: never more than the small drift off straight', () => {
    const legs = flowPieces(3, 240);
    const ys = legs.flat().map((p) => Math.abs(p.y));
    expect(Math.max(...ys)).toBeLessThanOrEqual(FLOW_AMP);
    expect(FLOW_AMP).toBeLessThanOrEqual(3);
  });

  it('crosses back through every stop, so the dots stay where they are', () => {
    const legs = flowPieces(2, 200);
    // The first stroke starts level at the origin, the last ends level at the stop and the next leg starts there.
    expect(Math.abs(legs[0][0].y)).toBeLessThan(0.4);
    expect(Math.abs(legs[0][legs[0].length - 1].y)).toBeLessThan(0.4);
    expect(Math.abs(legs[1][0].y)).toBeLessThan(0.4);
    // Strokes run left to right with no gaps.
    for (const pieces of legs) for (const p of pieces) expect(p.len).toBeGreaterThan(200 / 2 / 12);
  });

  it('turns through a stop with no corner: the heading in matches the heading out', () => {
    const [a, b] = flowPieces(2, 200);
    expect(a[a.length - 1].angle).toBeCloseTo(b[0].angle, 2);
    // One leg dips, the next rises: a wave, not a row of arches.
    expect(flowSign(0)).toBe(-flowSign(1));
  });
});

describe('MiniRoute flow', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const layout = (width: number) => {
    const rail = r!.root.find((n) => typeof n.type === 'string' && typeof n.props.onLayout === 'function');
    act(() => rail.props.onLayout({ nativeEvent: { layout: { width, height: 40, x: 0, y: 0 } } }));
  };
  const all = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');

  it('draws a connection as a flowing line once it knows its width', () => {
    act(() => {
      r = create(<MiniRoute airports={['DAL', 'DEN', 'SEA']} legs={[leg('#1f9e6a'), leg('#c9861a')]} />);
    });
    // Straight until measured, so nothing jumps.
    expect(all('mini-route-seg')).toHaveLength(2);
    layout(220);
    expect(all('mini-route-seg')).toHaveLength(0);
    const pieces = all('mini-route-flow');
    expect(pieces.length).toBe(24);
    // Each leg keeps its own seat color.
    expect(flat(pieces[0].props.style).backgroundColor).toBe('#1f9e6a');
    expect(flat(pieces[pieces.length - 1].props.style).backgroundColor).toBe('#c9861a');
  });

  it('keeps a nonstop straight', () => {
    act(() => {
      r = create(<MiniRoute airports={['DAL', 'LAX']} legs={[leg('#1f9e6a')]} />);
    });
    layout(220);
    expect(all('mini-route-flow')).toHaveLength(0);
    expect(all('mini-route-seg')).toHaveLength(1);
  });

  it('moves a canceled X onto the curve', () => {
    act(() => {
      r = create(<MiniRoute airports={['DAL', 'DEN', 'SEA']} legs={[leg('#d33', { canceled: true }), leg('#1f9e6a')]} />);
    });
    const before = flat(all('mini-route-canceled')[0].props.style).top;
    layout(220);
    const after = flat(all('mini-route-canceled')[0].props.style).top;
    expect(after - before).toBeCloseTo(flowSign(0) * FLOW_AMP, 5);
  });
});
