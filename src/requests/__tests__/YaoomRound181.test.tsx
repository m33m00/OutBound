import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { SettingsProvider, useSettings } from '@/settings/SettingsProvider';
import { DEFAULT_SETTINGS, parseSettings } from '@/settings/settings';
import { resetSounds } from '@/ui/sounds';

import { newlyAnswered, sampleMine } from '../requests';
import { RequestsProvider, useRequests } from '../RequestsProvider';

const created = createAudioPlayer as jest.Mock;

let req: ReturnType<typeof useRequests>;
let set: ReturnType<typeof useSettings>;
function Probe() {
  req = useRequests();
  set = useSettings();
  return null;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('yaoom when a request is answered (round 181, John)', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => {
    created.mockClear();
    resetSounds();
  });
  afterEach(() => act(() => r?.unmount()));

  it('sound effects are on by default and saved', () => {
    expect(DEFAULT_SETTINGS.sounds).toBe(true);
    expect(parseSettings({ sounds: false }).sounds).toBe(false);
    expect(parseSettings({}).sounds).toBe(true);
  });

  it('finds asks answered since last look', () => {
    const mine = sampleMine(Date.now());
    const seen = new Set(mine.filter((m) => m.answer).map((m) => m.id));
    expect(newlyAnswered(seen, mine)).toEqual([]);
    expect(newlyAnswered(new Set(), mine).length).toBe(mine.filter((m) => m.answer).length);
  });

  it('stays quiet for asks already answered at launch, then plays once when one comes in, following the silent switch', async () => {
    await act(async () => {
      r = create(
        <SettingsProvider>
          <RequestsProvider>
            <Probe />
          </RequestsProvider>
        </SettingsProvider>,
      );
      await flush();
    });
    // Loaded ahead of time (round 182) but not played.
    expect(created).toHaveBeenCalledTimes(1);
    const player = created.mock.results[0].value;
    expect(player.play).not.toHaveBeenCalled();
    const waiting = req.mine.find((m) => !m.answer)!;
    await act(async () => {
      req.addAnswered(waiting.flight, { open: 20, listed: 3, at: Date.now() });
      await flush();
    });
    expect(created).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  });

  it('plays nothing with Sound effects off', async () => {
    await act(async () => {
      r = create(
        <SettingsProvider>
          <RequestsProvider>
            <Probe />
          </RequestsProvider>
        </SettingsProvider>,
      );
      await flush();
    });
    await act(async () => {
      set.update({ sounds: false });
      await flush();
    });
    const waiting = req.mine.find((m) => !m.answer)!;
    await act(async () => {
      req.addAnswered(waiting.flight, { open: 20, listed: 3, at: Date.now() });
      await flush();
    });
    const played = created.mock.results.some((x) => (x.value.play as jest.Mock).mock.calls.length > 0);
    expect(played).toBe(false);
  });
});

describe('yaoom plays reliably (round 182, John: "I dont hear the yaoom")', () => {
  beforeEach(() => {
    created.mockClear();
    resetSounds();
  });

  it('loads the sound ahead of time and plays a fresh player without rewinding it', async () => {
    const { preloadSounds, playYaoom } = jest.requireActual('@/ui/sounds') as typeof import('@/ui/sounds');
    preloadSounds();
    expect(created).toHaveBeenCalledTimes(1);
    playYaoom();
    const player = created.mock.results[0].value;
    expect(created).toHaveBeenCalledTimes(1);
    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('rewinds a player that already played, then plays again', async () => {
    const { playYaoom } = jest.requireActual('@/ui/sounds') as typeof import('@/ui/sounds');
    playYaoom();
    const player = created.mock.results[0].value;
    player.currentTime = 1.2;
    playYaoom();
    await flush();
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(2);
  });
});
