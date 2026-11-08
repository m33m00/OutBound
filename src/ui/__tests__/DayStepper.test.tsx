import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { dateChips } from '@/search/dates';

import { DAY_GAP, DAY_MIN, DayStepper, fitDays, neighborDays, windowStart } from '../DayStepper';

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

describe('whole day buttons only (round 180, John: arrows overlapping a date)', () => {
  it('fits as many whole buttons as there is room for and sizes them to fill the row exactly', () => {
    const f = fitDays(277, 8)!;
    expect(f.n).toBe(3);
    expect(f.w).toBeGreaterThanOrEqual(DAY_MIN);
    expect(f.n * f.w + (f.n - 1) * DAY_GAP).toBeCloseTo(277);
    expect(fitDays(0, 8)).toBeNull();
    expect(fitDays(2000, 8)!.n).toBe(8);
    expect(fitDays(40, 8)!.n).toBe(1);
  });

  it('keeps the shown days unless the picked day is out of view, then moves just enough', () => {
    expect(windowStart(2, 3, 3, 8)).toBe(2);
    expect(windowStart(2, 5, 3, 8)).toBe(3);
    expect(windowStart(2, 1, 3, 8)).toBe(1);
    expect(windowStart(0, 7, 3, 8)).toBe(5);
    expect(windowStart(9, 7, 3, 8)).toBe(5);
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

  it('has arrows at both ends that step a day and dim at the ends of the window (round 179, John)', () => {
    const onDay = jest.fn();
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-31" label="Sat, Oct 31" onDay={onDay} />);
    });
    const arrow = (dir: 'prev' | 'next') =>
      r!.root.findAll((n) => n.props.testID === `day-${dir}` && n.props.accessibilityRole === 'button')[0];
    // The day buttons sit between the two arrows.
    expect(arrow('next').props.accessibilityLabel).toBe('Next day, Sunday, November 1');
    act(() => arrow('next').props.onPress());
    expect(onDay).toHaveBeenLastCalledWith('2026-11-01');
    act(() => arrow('prev').props.onPress());
    expect(onDay).toHaveBeenLastCalledWith('2026-10-30');
    act(() => {
      r!.update(<DayStepper days={DAYS} date="2026-10-30" label="Fri, Oct 30" onDay={onDay} />);
    });
    expect(arrow('prev').props.accessibilityState).toEqual({ disabled: true });
    expect(arrow('prev').props.accessibilityLabel).toBe('Previous day');
    act(() => {
      r!.update(<DayStepper days={DAYS} date={DAYS[DAYS.length - 1].date} label="last" onDay={onDay} />);
    });
    expect(arrow('next').props.accessibilityState).toEqual({ disabled: true });
  });

  it('sizes every day button to fit whole between the arrows once the row is measured (round 180)', () => {
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-30" label="Fri, Oct 30" onDay={() => {}} />);
    });
    const list = r!.root.findAll((n) => n.props.accessibilityRole === 'radiogroup' && typeof n.props.onLayout === 'function')[0];
    act(() => list.props.onLayout({ nativeEvent: { layout: { width: 277, height: 60, x: 0, y: 0 } } }));
    const f = fitDays(277, DAYS.length)!;
    const flat = (st: unknown) =>
      Object.assign(
        {},
        ...([] as unknown[])
          .concat(st as never)
          .flat(3)
          .filter(Boolean),
      );
    for (const d of DAYS) {
      const chip = r!.root.findAll((n) => n.props.testID === `day-${d.date}` && typeof n.props.style === 'function')[0];
      expect(flat(chip.props.style({ pressed: false })).width).toBeCloseTo(f.w);
    }
    expect(r!.root.findAll((n) => n.props.snapToInterval === f.w + DAY_GAP).length).toBeGreaterThan(0);
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
