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

describe('the answer sound when a request is answered (round 181; a fart since round 194, John)', () => {
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

  it('stays quiet for asks already answered at launch, then plays once when one comes in', async () => {
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
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
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

describe('the answer sound player (rounds 182 to 184, John: "I dont hear the yaoom")', () => {
  const sounds = jest.requireActual('@/ui/sounds') as typeof import('@/ui/sounds');
  beforeEach(() => {
    created.mockClear();
    (setAudioModeAsync as jest.Mock).mockClear();
    sounds.resetSounds();
  });

  it('sets the audio mode (plays on silent too, mixed with music) before it makes the player', async () => {
    const order: string[] = [];
    (setAudioModeAsync as jest.Mock).mockImplementationOnce(() => {
      order.push('mode');
      return Promise.resolve();
    });
    created.mockImplementationOnce(() => {
      order.push('player');
      return { currentTime: 0, play: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), addListener: jest.fn() };
    });
    await sounds.playAnswerSound();
    expect(order).toEqual(['mode', 'player']);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  });

  it('loads once ahead of time and plays a fresh player without rewinding it', async () => {
    sounds.preloadSounds();
    await sounds.playAnswerSound();
    expect(created).toHaveBeenCalledTimes(1);
    const player = created.mock.results[0].value;
    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('rewinds a player that already played, then plays again', async () => {
    await sounds.playAnswerSound();
    const player = created.mock.results[0].value;
    player.currentTime = 1.2;
    await sounds.playAnswerSound();
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it("gives iPhone a data URI, which never depends on an update file's name, and Android the bundled file", () => {
    const ios = sounds.answerSoundSource('ios') as { uri: string };
    expect(ios.uri.startsWith('data:audio/mp4;base64,')).toBe(true);
    expect(ios.uri.length).toBeGreaterThan(5000);
    expect(typeof sounds.answerSoundSource('android')).not.toBe('string');
  });

  it('is the fart now, not the yoooom (round 194, John: "Remove the yaoom sound effect and do a fart sound effect")', () => {
    const { FART_DATA_URI } = jest.requireActual('@/ui/fartData') as { FART_DATA_URI: string };
    expect((sounds.answerSoundSource('ios') as { uri: string }).uri).toBe(FART_DATA_URI);
    expect(FART_DATA_URI).not.toContain('yaoom');
  });

  it('keeps what the sound last did and says it in words for Settings (round 184)', async () => {
    const fmt = () => '9:41:00 AM';
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: not loaded yet.');
    sounds.preloadSounds();
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: loading the sound…');
    await flush();
    const player = created.mock.results[0].value;
    const onStatus = (player.addListener as jest.Mock).mock.calls.find((c) => c[0] === 'playbackStatusUpdate')![1];
    onStatus({ isLoaded: true, playing: false, error: null });
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: loaded, not played yet.');
    await sounds.playAnswerSound();
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: playing now.');
    onStatus({ isLoaded: true, playing: false, error: null });
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: loaded, last played 9:41:00 AM.');
    onStatus({ isLoaded: false, error: 'Cannot Open' });
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe("Sound check: the sound couldn't load (Cannot Open).");
  });
});
