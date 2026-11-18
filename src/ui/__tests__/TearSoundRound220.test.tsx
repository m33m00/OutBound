import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SettingsProvider } from '@/settings/SettingsProvider';

import { SaveRouteButton } from '../SaveRouteButton';
import * as sounds from '../sounds';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockTear = jest.fn();
jest.mock('../TearAway', () => ({
  ...jest.requireActual('../TearAway'),
  useTearAway: () => mockTear,
  useTearSource: () => ({}),
  useIsTearCopy: () => false,
}));

// Round 220 (John: "when I save a ticket and it tears can you have a sound effect for that").
describe('the ticket tear sound (round 220)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
    mockTear.mockClear();
  });

  const press = () => {
    const button = r!.root.findAll((n) => n.props.testID === 'save-route' && typeof n.props.onPress === 'function')[0];
    act(() => button.props.onPress());
  };

  it('plays a soft paper rip when saving tears the ticket off, and nothing when taking it back out', async () => {
    const play = jest.spyOn(sounds, 'playSound').mockResolvedValue();
    await act(async () => {
      r = create(
        <SettingsProvider>
          <SaveRouteButton saved={false} onPress={jest.fn()} />
        </SettingsProvider>,
      );
    });
    press();
    expect(mockTear).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('tear');
    play.mockClear();
    await act(async () => {
      r!.update(
        <SettingsProvider>
          <SaveRouteButton saved onPress={jest.fn()} />
        </SettingsProvider>,
      );
    });
    press();
    expect(play).not.toHaveBeenCalled();
  });

  it('is in the sound set as its own short file', () => {
    expect(sounds.SOUND_NAMES).toContain('tear');
    const uri = (sounds.soundSource('tear', 'ios') as { uri: string }).uri;
    expect(uri.startsWith('data:audio/mp4;base64,')).toBe(true);
  });
});
