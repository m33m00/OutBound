import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { Button } from '../Buttons';
import { LOADER_ASPECT, LOADER_TIMING, TrailLoader } from '../TrailLoader';

// Node's own modules, typed loosely: the app's tsconfig has no Node types.
declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require('node:fs');
const path = require('node:path');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);
const flat = (st: unknown) => StyleSheet.flatten(st as never) ?? {};
const shiftX = (st: unknown) =>
  (flat(st).transform as { translateX?: unknown }[] | undefined)?.find((t) => 'translateX' in t)?.translateX;

function walk(dir: string, out: string[] = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true }) as { name: string; isDirectory: () => boolean }[]) {
    const p: string = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name !== '__tests__') walk(p, out);
    } else if (/\.tsx?$/.test(f.name)) out.push(p);
  }
  return out;
}

// Round 223 (John: "Can you streamline the animation of the T across the app. Where it uses the plane and trail.
// For anything loading etc").
describe('the plane and trail loader (round 223)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    r = undefined;
    jest.restoreAllMocks();
  });

  it('is the only loading animation: no system spinner is left anywhere in the app', () => {
    const files = walk(path.join(__dirname, '..', '..'));
    const spinners = files.filter((f) => /\bActivityIndicator\b/.test(fs.readFileSync(f, 'utf8')));
    expect(spinners).toEqual([]);
  });

  it('draws the trail in behind the plane: the wipe starts closed and the plane starts at the tail', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await act(async () => {
      r = create(<TrailLoader size={30} />);
    });
    const box = host(r!, 'trail-loader')[0];
    expect(flat(box.props.style).height).toBe(30);
    expect(flat(box.props.style).width).toBeCloseTo(30 * LOADER_ASPECT, 0);
    expect(box.props.accessibilityRole).toBe('progressbar');
    const wipe = host(r!, 'trail-loader-wipe')[0];
    expect(shiftX(wipe.props.style)).toBe(-flat(wipe.props.style).width);
    expect(shiftX(host(r!, 'trail-loader-plane')[0].props.style)).toBe(0);
    expect(LOADER_TIMING.draw).toBe(900);
  });

  it('with Reduce Motion on nothing moves: the finished t shows and only fades', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await act(async () => {
      r = create(<TrailLoader size={30} />);
    });
    expect(shiftX(host(r!, 'trail-loader-wipe')[0].props.style)).toBe(0);
    expect(shiftX(host(r!, 'trail-loader-plane')[0].props.style)).toBeGreaterThan(0);
  });

  it('a busy button shows the loader, stays full strength and ignores another tap', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const onPress = jest.fn();
    await act(async () => {
      r = create(<Button label="Logging In" onPress={onPress} busy />);
    });
    expect(host(r!, 'trail-loader')).toHaveLength(1);
    const button = r!.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button')[0];
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    await act(async () => {
      r!.update(<Button label="Log In" onPress={onPress} />);
    });
    expect(host(r!, 'trail-loader')).toHaveLength(0);
  });
});
