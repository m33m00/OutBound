import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { dateChips } from '@/search/dates';

import { DayStepper, neighborDays } from '../DayStepper';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAYS = dateChips('2026-10-30');

describe('neighborDays', () => {
  it('gives the day before and after', () => {
    const { prev, next } = neighborDays(DAYS, '2026-11-02');
    expect(prev?.date).toBe('2026-11-01');
    expect(next?.date).toBe('2026-11-03');
  });

  it('has no previous day on today and no next day on the last day', () => {
    expect(neighborDays(DAYS, '2026-10-30').prev).toBeNull();
    expect(neighborDays(DAYS, DAYS[DAYS.length - 1].date).next).toBeNull();
  });

  it('gives neither for a date outside the window', () => {
    expect(neighborDays(DAYS, '2026-12-25')).toEqual({ prev: null, next: null });
  });
});

describe('DayStepper', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const chip = (date: string) =>
    r!.root.findAll((n) => n.props.testID === `day-${date}` && n.props.accessibilityRole === 'radio')[0];
  const words = () =>
    r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);

  it('says what it is and shows every day in the window as a button (round 177, John)', () => {
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-31" label="Sat, Oct 31" onDay={jest.fn()} detail="4 routes" />);
    });
    expect(words()).toContain('Departing Sat, Oct 31');
    for (const d of DAYS) expect(chip(d.date)).toBeDefined();
    expect(words()).toContain('Today');
    expect(words()).toContain('Tomorrow');
    expect(words()).toContain('Oct 31');
    const detail = r!.root.findAll((n) => n.props.testID === 'day-detail' && typeof n.type === 'string')[0];
    expect(detail.props.children).toBe('4 routes');
  });

  it('marks the searched day and searches another day on a tap, naming it for VoiceOver', () => {
    const onDay = jest.fn();
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-31" label="Sat, Oct 31" onDay={onDay} detail="4 routes" />);
    });
    const on = chip('2026-10-31');
    expect(on.props.accessibilityState).toEqual({ checked: true });
    expect(on.props.accessibilityLabel).toBe('Saturday, October 31, 4 routes');
    expect(on.props.onPress).toBeUndefined();
    const next = chip('2026-11-01');
    expect(next.props.accessibilityState).toEqual({ checked: false });
    expect(next.props.accessibilityLabel).toBe('Sunday, November 1');
    act(() => next.props.onPress());
    expect(onDay).toHaveBeenCalledWith('2026-11-01');
  });

  it('fills the searched day blue and the others light blue, so they read as buttons', () => {
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-31" label="Sat, Oct 31" onDay={jest.fn()} />);
    });
    const bg = (date: string) => {
      const st = chip(date).props.style;
      const resolved = typeof st === 'function' ? st({ pressed: false }) : st;
      return Object.assign({}, ...[resolved].flat(Infinity).filter(Boolean)).backgroundColor as string;
    };
    expect(bg('2026-10-31')).not.toBe(bg('2026-11-01'));
    expect(bg('2026-11-01')).toBe(bg('2026-10-30'));
  });
});
