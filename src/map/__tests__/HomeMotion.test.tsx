/** Preview arc and home ripple (John, 2026-11-01), with Skia mocked to plain elements. */
jest.mock('@shopify/react-native-skia', () => ({
  Circle: 'Circle',
  Path: 'SkiaPath',
  Skia: { Path: { MakeFromSVGString: (d: string) => ({ d }) } },
}));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { HomeRipple, PreviewArc, runsPath } from '../HomeMotion';
import { PREVIEW } from '../homeMotionTiming';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const runs = [
  [
    { x: 0, y: 0 },
    { x: 10, y: 5 },
    { x: 20, y: 0 },
  ],
];

describe('home motion layers', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    jest.useRealTimers();
  });

  it('turns screen runs into one path, none when nothing shows', () => {
    expect(runsPath(runs)).toEqual({ d: expect.stringMatching(/^M/) });
    expect(runsPath([])).toBeNull();
  });

  it('with Reduce Motion the preview arc is simply there, whole and faint', () => {
    act(() => {
      r = create(<PreviewArc runs={runs} pairKey="LAX-DAL" color="#123456" animate={false} />);
    });
    const arc = r!.root.findByType('SkiaPath' as never);
    expect(arc.props).toMatchObject({ start: 0, end: 1, opacity: PREVIEW.alpha, color: '#123456' });
  });

  it('otherwise it draws itself in from From, then stays whole', () => {
    jest.useFakeTimers();
    act(() => {
      r = create(<PreviewArc runs={runs} pairKey="LAX-DAL" color="#123456" animate />);
    });
    expect(r!.root.findAllByType('SkiaPath' as never)).toHaveLength(0);
    act(() => jest.advanceTimersByTime(PREVIEW.drawMs / 2));
    const mid = r!.root.findByType('SkiaPath' as never).props.end as number;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    act(() => jest.advanceTimersByTime(PREVIEW.drawMs));
    expect(r!.root.findByType('SkiaPath' as never).props.end).toBe(1);
  });

  it('the home ripple is a soft ring around the pin', () => {
    jest.useFakeTimers();
    act(() => {
      r = create(<HomeRipple x={50} y={60} r={8} color="#c46a10" />);
    });
    act(() => jest.advanceTimersByTime(200));
    const ring = r!.root.findByType('Circle' as never);
    expect(ring.props).toMatchObject({ cx: 50, cy: 60, style: 'stroke', color: '#c46a10' });
    expect(ring.props.r).toBeGreaterThan(8);
    expect(ring.props.opacity).toBeLessThan(0.5);
  });
});
