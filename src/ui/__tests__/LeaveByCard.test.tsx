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

/** The slim row's whole text: the title and its one detail (round 87). */
function lineText(r: ReactTestRenderer): string {
  const line = r.root.find((n) => n.props.testID === 'leave-by-line' && typeof n.type === 'string');
  const flat = (c: unknown): string =>
    typeof c === 'string'
      ? c
      : Array.isArray(c)
        ? c.map(flat).join('')
        : c && typeof c === 'object' && 'children' in c
          ? flat((c as { children: unknown }).children)
          : '';
  return flat(line.children);
}

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
    // No icon tile (round 69); a car says the card opens directions, button or not (round 136, John).
    const top = r!.root.findAll((n) => n.props.testID === 'leave-by-top' && typeof n.type === 'string')[0];
    const icons = top.findAll((n) => typeof n.props.name === 'string').map((n) => n.props.name);
    expect(icons).toContain('car.fill');
    expect(icons).not.toContain('chevron.right');
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
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(lineText(r!)).toMatch(/^Departed/);
    expect(r!.root.findAll((n) => /Use Location|Open Settings/.test(String(n.props.accessibilityLabel)))).toHaveLength(0);
    expect(texts.some((t) => t.startsWith('Location is off'))).toBe(false);
    // Once it has left, the delay line goes too.
    expect(texts.some((t) => t.startsWith('Flight delayed'))).toBe(false);
  });

  it('keeps the scheduled leave-by; the delay is spoken, not shown under it (Q-070; round 158, John)', () => {
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
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(texts).not.toContain('Flight delayed to 2:40 PM');
    // The title still counts back from the schedule: 4 h out minus the 60 min buffer.
    // John's words, with nothing beside them (round 159).
    expect(lineText(r!)).toMatch(/^Arrive at DFW by \d{1,2}:\d\d\u00a0[AP]M to begin boarding$/);
    const label = r!.root.find(
      (n) =>
        n.props.accessible &&
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Arrive at'),
    ).props.accessibilityLabel as string;
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
    expect(open).toHaveBeenCalledWith(AIRPORTS.DFW, 'google', undefined);
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

  it('is one slim row: the time and the boarding line, with the drive time on the directions button (rounds 169, 193)', () => {
    mockFontScale = 1;
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DFW}
          departUtc={NOW + 4 * 3600_000}
          bufferMin={60}
          now={NOW}
          location={{ lat: 32.85, lon: -96.85, at: NOW }}
          locationStatus="idle"
          onUseLocation={jest.fn()}
          liveDriveMin={32}
        />,
      );
    });
    // The time, then the boarding line beside it like Leave now's (round 193, John: some had it, some didn't).
    expect(lineText(r!)).toMatch(/^Leave by \d{1,2}:\d{2}\u00a0(AM|PM)/);
    expect(lineText(r!)).toContain('Arrive at DFW by');
    expect(lineText(r!)).toContain('to begin boarding');
    expect(lineText(r!)).not.toContain('·');
    // John: "can the estimated time to drive there be next to the car icon".
    const car = r!.root.find((n) => n.props.testID === 'leave-by-car' && typeof n.type === 'string');
    expect(car.find((n) => n.props.testID === 'leave-by-drive' && typeof n.type === 'string').props.children).toBe('32m');
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    // The drive time is only by the car, not in the line.
    expect(texts.some((t) => t.includes('32m drive'))).toBe(false);
    const label = r!.root.find((n) => n.props.accessible && String(n.props.accessibilityLabel).startsWith('Leave by')).props
      .accessibilityLabel as string;
    expect(label).toContain('at DFW by');
  });

  it('shows directions as a filled blue button, so the card reads as tappable (round 169)', () => {
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
        />,
      );
    });
    const go = r!.root.find((n) => n.props.testID === 'leave-by-go' && typeof n.type === 'string');
    const style = Object.assign({}, ...[go.props.style].flat(5).filter(Boolean));
    expect(style.backgroundColor).toBe('#1c5fd4');
    expect(style.borderRadius).toBeGreaterThanOrEqual(16);
    expect(style.minHeight).toBeGreaterThanOrEqual(32);
    // No location yet: just the car, no made-up drive time.
    expect(r!.root.findAll((n) => n.props.testID === 'leave-by-car' && typeof n.type === 'string')).toHaveLength(1);
    expect(r!.root.findAll((n) => n.props.testID === 'leave-by-drive')).toHaveLength(0);
  });

  it('keeps the drive time by the car when it is already time to leave', () => {
    mockFontScale = 1;
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DFW}
          departUtc={NOW + 80 * 60_000}
          bufferMin={60}
          now={NOW}
          location={{ lat: 32.85, lon: -96.85, at: NOW }}
          locationStatus="idle"
          onUseLocation={jest.fn()}
          liveDriveMin={32}
        />,
      );
    });
    expect(lineText(r!)).toMatch(/^Leave now/);
    const drive = r!.root.find((n) => n.props.testID === 'leave-by-drive' && typeof n.type === 'string');
    expect(drive.props.children).toBe('32m');
    const label = r!.root.find((n) => n.props.accessible && String(n.props.accessibilityLabel).startsWith('Leave now')).props
      .accessibilityLabel as string;
    expect(label).toContain('32 minutes drive');
  });

  it('puts the detail on its own line, with no dot, when the row would wrap (John, 2026-11-02)', () => {
    mockFontScale = 1;
    act(() => {
      r = create(
        <LeaveByCard
          airport={AIRPORTS.DAL}
          departUtc={NOW + 2 * 3600_000}
          bufferMin={60}
          now={NOW}
          location={{ lat: AIRPORTS.DAL.lat, lon: AIRPORTS.DAL.lon, at: NOW }}
          locationStatus="idle"
          onUseLocation={jest.fn()}
        />,
      );
    });
    expect(lineText(r!)).toMatch(/^You’re at DAL \(Dallas Love Field\)\u2002\|\u2002Your flight begins boarding at /);
    const line = r!.root.find((n) => n.props.testID === 'leave-by-line' && typeof n.type === 'string');
    act(() => line.props.onTextLayout({ nativeEvent: { lines: [{}, {}] } }));
    expect(lineText(r!)).toBe('You’re at DAL (Dallas Love Field)');
    const detail = r!.root.find((n) => n.props.testID === 'leave-by-detail' && typeof n.type === 'string');
    expect([detail.props.children].flat().join('')).toMatch(/^Your flight begins boarding at /);
  });

  it('at the airport: a walking person with the gate under it, walking directions to the gate (round 159, John)', () => {
    mockFontScale = 1;
    const open = openDirections as jest.Mock;
    open.mockClear();
    const atDal = (gate: string | null, terminal: string | null) =>
      act(() => {
        r = create(
          <LeaveByCard
            airport={AIRPORTS.DAL}
            departUtc={NOW + 2 * 3600_000}
            bufferMin={60}
            now={NOW}
            location={{ lat: AIRPORTS.DAL.lat, lon: AIRPORTS.DAL.lon, at: NOW }}
            locationStatus="idle"
            onUseLocation={jest.fn()}
            gate={gate}
            terminal={terminal}
          />,
        );
      });
    atDal('12', null);
    expect(r!.root.findAll((n) => n.props.testID === 'leave-by-car')).toHaveLength(0);
    const walk = r!.root.find((n) => n.props.testID === 'leave-by-walk' && typeof n.type === 'string');
    const gate = walk.find((n) => n.props.testID === 'leave-by-gate' && typeof n.type === 'string');
    expect(gate.props.children).toBe('12');
    const card = r!.root.find((n) => n.props.testID === 'leave-by-card' && typeof n.props.onPress === 'function');
    expect(card.props.disabled).toBe(false);
    act(() => card.props.onPress());
    expect(open).toHaveBeenCalledWith(AIRPORTS.DAL, 'apple', { gate: '12', terminal: null });
    const title = r!.root.find((n) => n.props.accessibilityRole === 'button' && typeof n.props.onAccessibilityTap === 'function');
    expect(title.props.accessibilityHint).toBe('Opens walking directions to gate 12 in Apple Maps');
    expect(title.props.accessibilityLabel).toContain('Gate 12');
    // No gate posted yet: the walking person alone, routing to the terminal.
    atDal(null, null);
    expect(r!.root.findAll((n) => n.props.testID === 'leave-by-walk' && typeof n.type === 'string')).toHaveLength(1);
    expect(r!.root.findAll((n) => n.props.testID === 'leave-by-gate')).toHaveLength(0);
    const t2 = r!.root.find((n) => n.props.accessibilityRole === 'button' && typeof n.props.onAccessibilityTap === 'function');
    expect(t2.props.accessibilityHint).toBe('Opens walking directions to your terminal in Apple Maps');
  });
});
