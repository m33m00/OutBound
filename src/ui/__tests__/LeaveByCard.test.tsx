import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AIRPORTS } from '@/engine';

import { LeaveByCard } from '../LeaveByCard';
import { openDirections } from '../openDirections';

jest.mock('../openDirections', () => ({ openDirections: jest.fn(() => Promise.resolve(true)) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

const NOW = Date.UTC(2026, 9, 30, 15);

describe('LeaveByCard location button', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const render = () =>
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DFW}
          departUtc={NOW + 4 * 3600_000}
          bufferMin={60}
          now={NOW}
          location={null}
          locationStatus="idle"
          onUseLocation={jest.fn()}
        />,
      );
    });
  // Where "Use Location" sits: inside the top row next to the time, or on a row of its own.
  const placement = () => {
    expect(r!.root.findAll((n) => n.props.accessibilityLabel === 'Use Location' && typeof n.type === 'string').length).toBe(1);
    const top = r!.root.findAll((n) => n.props.testID === 'leave-by-top' && typeof n.type === 'string')[0];
    const inTop = top.findAll((n) => n.props.accessibilityLabel === 'Use Location' && typeof n.type === 'string');
    return inTop.length ? 'inline' : 'own row';
  };

  it('sits at the end of the top row at normal text sizes', () => {
    mockFontScale = 1;
    render();
    expect(placement()).toBe('inline');
    // No icon tile (round 69); the chevron still says the card opens directions, button or not.
    const top = r!.root.findAll((n) => n.props.testID === 'leave-by-top' && typeof n.type === 'string')[0];
    const icons = top.findAll((n) => typeof n.props.name === 'string').map((n) => n.props.name);
    expect(icons).toContain('chevron.right');
    expect(icons).not.toContain('arrow.triangle.turn.up.right.diamond.fill');
  });

  it('gets its own row at large text sizes so the time is never squeezed', () => {
    mockFontScale = 1.5;
    render();
    expect(placement()).toBe('own row');
  });

  it('says Departed and offers no location for a route that already left (round 42)', () => {
    mockFontScale = 1;
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DFW}
          departUtc={NOW - 600_000}
          bufferMin={60}
          now={NOW}
          location={null}
          locationStatus="denied"
          onUseLocation={jest.fn()}
          departed
          delayedText="2:40 PM"
        />,
      );
    });
    const texts = r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(texts).toContain('Departed');
    expect(r!.root.findAll((n) => /Use Location|Open Settings/.test(String(n.props.accessibilityLabel)))).toHaveLength(0);
    expect(texts.some((t) => t.startsWith('Location is off'))).toBe(false);
    // Once it has left, the delay line goes too.
    expect(texts.some((t) => t.startsWith('Flight delayed'))).toBe(false);
  });

  it('keeps the scheduled leave-by and adds the delay under it (Q-070, John: C)', () => {
    mockFontScale = 1;
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DFW}
          departUtc={NOW + 4 * 3600_000}
          bufferMin={60}
          now={NOW}
          location={null}
          locationStatus="idle"
          onUseLocation={jest.fn()}
          delayedText="2:40 PM"
        />,
      );
    });
    const texts = r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(texts).toContain('Flight delayed to 2:40 PM');
    // The title still counts back from the schedule: 4 h out minus the 60 min buffer.
    expect(texts.some((t) => t.startsWith('Be at DFW by '))).toBe(true);
    const label = r!.root.find((n) => n.props.accessible && typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Be at')).props
      .accessibilityLabel as string;
    expect(label).toContain('Flight delayed to 2:40 PM');
  });

  it('opens directions to the airport from a tap or from VoiceOver (John, 2026-10-30)', () => {
    mockFontScale = 1;
    const open = openDirections as jest.Mock;
    open.mockClear();
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DFW}
          departUtc={NOW + 4 * 3600_000}
          bufferMin={60}
          now={NOW}
          location={null}
          locationStatus="idle"
          onUseLocation={jest.fn()}
          mapsApp="google"
        />,
      );
    });
    const card = r!.root.find((n) => n.props.testID === 'leave-by-card' && typeof n.props.onPress === 'function');
    act(() => card.props.onPress());
    expect(open).toHaveBeenCalledWith(AIRPORTS.DFW, 'google');
    const title = r!.root.find((n) => n.props.accessibilityRole === 'button' && typeof n.props.onAccessibilityTap === 'function');
    expect(title.props.accessibilityHint).toBe('Opens directions in Google Maps');
    act(() => title.props.onAccessibilityTap());
    expect(open).toHaveBeenCalledTimes(2);
    // The location button is still its own VoiceOver stop.
    expect(r!.root.findAll((n) => n.props.accessibilityLabel === 'Use Location' && typeof n.type === 'string')).toHaveLength(1);
  });

  it('offers no directions once the flight has left', () => {
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DFW}
          departUtc={NOW - 600_000}
          bufferMin={60}
          now={NOW}
          location={null}
          locationStatus="idle"
          onUseLocation={jest.fn()}
          departed
        />,
      );
    });
    expect(r!.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onAccessibilityTap)).toHaveLength(0);
    expect(r!.root.find((n) => n.props.testID === 'leave-by-card' && 'disabled' in n.props).props.disabled).toBe(true);
  });
});
