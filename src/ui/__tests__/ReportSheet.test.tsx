import React from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { sampleFeed, sampleMine } from '@/requests/requests';

import { ReportSheet } from '../ReportSheet';
import { RequestRow } from '../RequestRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 30, 13);
const flight = sampleFeed(NOW)[0].flight;

const hostTexts = (r: ReactTestRenderer) =>
  r.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);
const button = (r: ReactTestRenderer, label: string) =>
  r.root.find((n) => typeof n.type !== 'string' && n.props.accessibilityLabel === label && n.props.onPress);

describe('ReportSheet', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('steps, types and reports the tier live, then submits both numbers', async () => {
    const onSubmit = jest.fn();
    await act(async () => {
      r = create(<ReportSheet flight={flight} now={NOW} onCancel={jest.fn()} onSubmit={onSubmit} />);
    });
    expect(hostTexts(r!)).toEqual(expect.arrayContaining(['Report Load', 'Open seats', 'Nonrevs listed']));
    const tier = () => r!.root.find((n) => n.props.testID === 'report-tier' && typeof n.type === 'string').props.accessibilityLabel;
    // Nothing set yet: no tier, and Submit is off.
    expect(tier()).toBe('Set the numbers from the board');
    expect(button(r!, 'Submit Report').props.disabled).toBe(true);
    // Minus is off at zero.
    expect(button(r!, 'Decrease: Open seats').props.disabled).toBe(true);

    const openInput = r!.root.find((n) => n.props.accessibilityLabel === 'Open seats, On the departure board' && n.props.onChangeText);
    act(() => openInput.props.onChangeText('2x0'));
    expect(tier()).toBe('Good, 20 seats after the standby list');
    act(() => button(r!, 'Increase: Nonrevs listed').props.onPress());
    act(() => button(r!, 'Increase: Nonrevs listed').props.onPress());
    expect(tier()).toBe('Good, 18 seats after the standby list');
    // The box follows − / + while you're on it.
    expect(openInput.props.value).toBe('20');
    act(() => button(r!, 'Increase: Open seats').props.onPress());
    expect(r!.root.find((n) => n.props.accessibilityLabel === 'Open seats, On the departure board' && n.props.onChangeText).props.value).toBe('21');
    act(() => button(r!, 'Decrease: Open seats').props.onPress());

    act(() => button(r!, 'Submit Report').props.onPress());
    expect(onSubmit).toHaveBeenCalledWith(20, 2);
  });

  it('typing past the limit stops at the limit', async () => {
    await act(async () => {
      r = create(<ReportSheet flight={flight} now={NOW} onCancel={jest.fn()} onSubmit={jest.fn()} />);
    });
    const listed = r!.root.find((n) => n.props.accessibilityLabel === 'Nonrevs listed, On the standby list' && n.props.onChangeText);
    act(() => listed.props.onChangeText('999'));
    expect(button(r!, 'Increase: Nonrevs listed').props.disabled).toBe(true);
    // The box shows the limit, not what was typed.
    const box = () => r!.root.find((n) => n.props.accessibilityLabel === 'Nonrevs listed, On the standby list' && n.props.onChangeText);
    expect(box().props.value).toBe('250');
    // Clearing the box counts as zero at once, and shows 0 once you leave it.
    act(() => box().props.onChangeText(''));
    expect(button(r!, 'Increase: Nonrevs listed').props.disabled).toBe(false);
    expect(box().props.value).toBe('');
    act(() => box().props.onBlur());
    expect(box().props.value).toBe('0');
  });

  it('Cancel leaves without a report', async () => {
    const onCancel = jest.fn();
    const onSubmit = jest.fn();
    await act(async () => {
      r = create(<ReportSheet flight={flight} now={NOW} onCancel={onCancel} onSubmit={onSubmit} />);
    });
    act(() => r!.root.find((n) => n.props.testID === 'sheet-action' && n.props.onPress).props.onPress());
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('RequestRow', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('an open ask has an Answer button and never names the asker', async () => {
    const req = sampleFeed(NOW)[0];
    const onAnswer = jest.fn();
    await act(async () => {
      r = create(<RequestRow request={req} now={NOW} onAnswer={onAnswer} />);
    });
    const answer = r!.root.find((n) => n.props.testID === 'answer-request' && n.props.onPress);
    // The button names its flight, so a list of Answer buttons reads apart.
    expect(answer.props.accessibilityLabel).toMatch(/^Answer WN \d+, \w{3} to \w{3}$/);
    act(() => answer.props.onPress());
    expect(onAnswer).toHaveBeenCalled();
    const label = r!.root.find((n) => n.props.accessible && typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('asked'))
      .props.accessibilityLabel as string;
    expect(label).toContain(' to ');
    expect(label).not.toContain('→');
  });

  it('a waiting ask on a delayed flight leads with the new time and shows the delay (round 50)', async () => {
    const waiting = sampleMine(NOW)[1];
    const sched = waiting.flight.departUtc;
    const leg = {
      tag: { kind: 'delayed' as const, label: 'Delayed 25m', spoken: 'Delayed 25 minutes' },
      struck: true,
      scheduledUtc: sched,
      scheduledText: '2:15 PM',
      newUtc: sched + 25 * 60_000,
      newText: '2:40 PM',
    };
    await act(async () => {
      r = create(<RequestRow request={waiting} now={NOW} mine leg={leg} onOpen={jest.fn()} />);
    });
    const texts = hostTexts(r!);
    expect(texts).toContain('Delayed 25m');
    expect(texts).toContain('2:15\u00a0PM');
    expect(texts.some((t) => t.startsWith('Departs '))).toBe(true);
    const label = r!.root.find((n) => n.props.testID === 'request-row' && n.props.onPress).props.accessibilityLabel as string;
    expect(label).toContain('Delayed 25 minutes');
    expect(label).toContain('Waiting');
  });

  it('your own asks say Answered with the numbers, or Waiting, and offer no Answer button', async () => {
    const [answered, waiting] = sampleMine(NOW);
    await act(async () => {
      r = create(
        <View>
          <RequestRow request={answered} now={NOW} mine />
          <RequestRow request={waiting} now={NOW} mine />
        </View>,
      );
    });
    const texts = hostTexts(r!);
    expect(texts).toEqual(expect.arrayContaining(['Answered', 'Waiting']));
    expect(texts.some((t) => / open · \d+ listed · answered /.test(t))).toBe(true);
    expect(r!.root.findAll((n) => n.props.testID === 'answer-request')).toHaveLength(0);
    // VoiceOver hears "answered" once (in the detail), and Waiting at the end.
    const labels = r!.root.findAll((n) => n.props.accessible && typeof n.props.accessibilityLabel === 'string').map((n) => String(n.props.accessibilityLabel));
    expect(labels.some((l) => /answered .*\. Answered$/.test(l))).toBe(false);
    expect(labels.some((l) => l.endsWith('. Waiting'))).toBe(true);
  });
});
