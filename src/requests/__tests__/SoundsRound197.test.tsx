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

describe('the answered chime when a request is answered (round 181; soft chimes since round 197, John)', () => {
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
    // One player per chime (round 197): answered, sent, leave.
    expect(created).toHaveBeenCalledTimes(3);
    const player = created.mock.results[0].value;
    expect(player.play).not.toHaveBeenCalled();
    const waiting = req.mine.find((m) => !m.answer)!;
    await act(async () => {
      req.addAnswered(waiting.flight, { open: 20, listed: 3, at: Date.now() });
      await flush();
    });
    expect(created).toHaveBeenCalledTimes(3);
    expect(player.play).toHaveBeenCalledTimes(1);
    // Only the answered chime; the others stay quiet.
    expect(created.mock.results[1].value.play).not.toHaveBeenCalled();
    expect(created.mock.results[2].value.play).not.toHaveBeenCalled();
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

describe('the chime players (rounds 182 to 184, and the round 197 set)', () => {
  const sounds = jest.requireActual('@/ui/sounds') as typeof import('@/ui/sounds');
  let clock = 1_000_000;
  beforeEach(() => {
    created.mockClear();
    (setAudioModeAsync as jest.Mock).mockClear();
    sounds.resetSounds();
    clock += 60_000;
    jest.spyOn(Date, 'now').mockImplementation(() => clock);
  });
  afterEach(() => jest.restoreAllMocks());
  const player = (name: 'answered' | 'sent' | 'leave') => created.mock.results[sounds.SOUND_NAMES.indexOf(name)].value;

  it('sets the audio mode (plays on silent too, mixed with music) before it makes the players', async () => {
    const order: string[] = [];
    (setAudioModeAsync as jest.Mock).mockImplementationOnce(() => {
      order.push('mode');
      return Promise.resolve();
    });
    created.mockImplementationOnce(() => {
      order.push('player');
      return { currentTime: 0, play: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), addListener: jest.fn() };
    });
    await sounds.playSound('answered');
    expect(order).toEqual(['mode', 'player']);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  });

  it('loads every chime once ahead of time and plays a fresh player without rewinding it', async () => {
    sounds.preloadSounds();
    await sounds.playSound('answered');
    expect(created).toHaveBeenCalledTimes(3);
    expect(created.mock.calls.map((c) => c[0])).toEqual(sounds.SOUND_NAMES.map((n) => sounds.soundSource(n)));
    expect(player('answered').seekTo).not.toHaveBeenCalled();
    expect(player('answered').play).toHaveBeenCalledTimes(1);
  });

  it('rewinds a player that already played, then plays again', async () => {
    await sounds.playSound('answered');
    player('answered').currentTime = 1.2;
    clock += sounds.SAME_SOUND_GAP_MS;
    await sounds.playSound('answered');
    expect(player('answered').seekTo).toHaveBeenCalledWith(0);
    expect(player('answered').play).toHaveBeenCalledTimes(2);
  });

  it('plays the same chime once when it is asked for twice at once (several cards flipping together)', async () => {
    await sounds.playSound('leave');
    await sounds.playSound('leave');
    expect(player('leave').play).toHaveBeenCalledTimes(1);
  });

  it('lets the sent tap finish before the answered chime (the demo answers a request at once)', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    try {
      await sounds.playSound('sent');
      const answered = sounds.playSound('answered');
      await Promise.resolve();
      await Promise.resolve();
      expect(player('sent').play).toHaveBeenCalledTimes(1);
      expect(player('answered').play).not.toHaveBeenCalled();
      jest.advanceTimersByTime(sounds.AFTER_SENT_MS);
      await answered;
      expect(player('answered').play).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("gives iPhone data URIs, which never depend on an update file's name, and Android the bundled files", () => {
    for (const name of sounds.SOUND_NAMES) {
      const ios = sounds.soundSource(name, 'ios') as { uri: string };
      expect(ios.uri.startsWith('data:audio/mp4;base64,')).toBe(true);
      expect(ios.uri.length).toBeGreaterThan(3000);
      expect(typeof sounds.soundSource(name, 'android')).not.toBe('string');
    }
  });

  it('is three soft chimes now, no fart or moan (round 197, John: "remove the current sound effects ... keep it subtle")', () => {
    expect(sounds.SOUND_NAMES).toEqual(['answered', 'sent', 'leave']);
    const uris = sounds.SOUND_NAMES.map((n) => (sounds.soundSource(n, 'ios') as { uri: string }).uri);
    expect(new Set(uris).size).toBe(3);
    expect(Object.keys(sounds)).not.toEqual(expect.arrayContaining(['moanSource']));
    expect(Object.keys(sounds)).not.toEqual(expect.arrayContaining(['answerSoundSource']));
  });

  it('keeps what the answered chime last did and says it in words for Settings (round 184)', async () => {
    const fmt = () => '9:41:00 AM';
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: not loaded yet.');
    sounds.preloadSounds();
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: loading the sound…');
    await flush();
    const onStatus = (player('answered').addListener as jest.Mock).mock.calls.find((c) => c[0] === 'playbackStatusUpdate')![1];
    onStatus({ isLoaded: true, playing: false, error: null });
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: loaded, not played yet.');
    await sounds.playSound('answered');
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: playing now.');
    onStatus({ isLoaded: true, playing: false, error: null });
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe('Sound check: loaded, last played 9:41:00 AM.');
    onStatus({ isLoaded: false, error: 'Cannot Open' });
    expect(sounds.soundCheckText(sounds.soundState(), fmt)).toBe("Sound check: the sound couldn't load (Cannot Open).");
  });
});
