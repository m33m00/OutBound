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

  const arrow = (dir: 'prev' | 'next') =>
    r!.root.findAll((n) => n.props.testID === `day-${dir}` && n.props.accessibilityRole === 'button')[0];

  it('steps to the next day and names it for VoiceOver', () => {
    const onDay = jest.fn();
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-31" label="Sat, Oct 31" onDay={onDay} />);
    });
    const next = arrow('next');
    expect(next.props.accessibilityLabel).toBe('Next day, Sunday, November 1');
    act(() => next.props.onPress());
    expect(onDay).toHaveBeenCalledWith('2026-11-01');
    act(() => arrow('prev').props.onPress());
    expect(onDay).toHaveBeenLastCalledWith('2026-10-30');
  });

  it('disables the previous arrow on today', () => {
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-30" label="Fri, Oct 30" onDay={jest.fn()} />);
    });
    const prev = arrow('prev');
    expect(prev.props.accessibilityState).toEqual({ disabled: true });
    expect(prev.props.accessibilityLabel).toBe('Previous day');
    expect(arrow('next').props.accessibilityState).toEqual({ disabled: false });
  });

  it('runs the full width with the route count under the date (John, 2026-10-30)', () => {
    act(() => {
      r = create(<DayStepper days={DAYS} date="2026-10-31" label="Sat, Oct 31" onDay={jest.fn()} detail="4 routes" />);
    });
    const box = r!.root.findAll((n) => typeof n.type === 'string')[0];
    const flat = Object.assign({}, ...[box.props.style].flat(Infinity).filter(Boolean));
    expect(flat.alignSelf).toBe('stretch');
    const detail = r!.root.findAll((n) => n.props.testID === 'day-detail' && typeof n.type === 'string')[0];
    expect(detail.props.children).toBe('4 routes');
    expect(r!.root.findAll((n) => n.props.accessibilityLabel === 'Saturday, October 31, 4 routes').length).toBeGreaterThan(0);
  });
});
