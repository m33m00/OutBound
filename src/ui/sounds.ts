import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { successTap } from './haptics';
import { FART_DATA_URI } from './fartData';
import { MOAN_DATA_URI } from './moanData';

/**
 * Sound effects (round 181). John: "add a sound sound effect when a request is answered". Round 194, John:
 * "Remove the sound sound effect and do a fart sound effect". The fart is an original sound made for OutBound
 * (design/fart-synth.py); no one else's audio is used.
 *
 * It plays over whatever else is on (mixWithOthers), so it never stops someone's music. Never throws:
 * a missed sound is fine.
 *
 * Round 183, John: "my phone is not muted I cant hear it". Rounds 181 and 182 loaded the sound as a
 * bundled file. In Expo Go an update keeps its files under bare content hashes with no file extension,
 * and iPhone's player can't tell what such a file is, so it most likely never loaded. On iPhone the
 * sound now comes from a data URI (AAC, audio/mp4): expo-audio writes it to a temp file that ends in
 * a real audio extension, which the player recognizes. Android still uses the bundled file.
 *
 * Whether it loaded is kept (useSoundState), so Settings can say so if it ever fails again.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ANSWER_SOUND_FILE = require('../../assets/sounds/fart.m4a');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MOAN_FILE = require('../../assets/sounds/moan.m4a');

export const answerSoundSource = (os: string = Platform.OS): AudioSource | number =>
  os === 'ios' ? { uri: FART_DATA_URI } : ANSWER_SOUND_FILE;

/** The relieved moan that follows the fart as its own clip (round 195, John: "add a separate moan noise"). */
export const moanSource = (os: string = Platform.OS): AudioSource | number => (os === 'ios' ? { uri: MOAN_DATA_URI } : MOAN_FILE);

/** The fart runs 1.42 s; the moan starts just after it ends. */
export const MOAN_AFTER_MS = 1550;

/**
 * What the sound last did, shown under Settings > Display (round 184) so we can see on John's phone
 * whether it loaded and played, since it can't be heard from here.
 */
export type SoundState =
  | { kind: 'idle' | 'loading' }
  | { kind: 'ready'; playedAt: number | null; playing: boolean }
  | { kind: 'failed'; detail: string };

let state: SoundState = { kind: 'idle' };
const listeners = new Set<() => void>();
function setState(next: SoundState) {
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  listeners.forEach((l) => l());
}
export const soundState = (): SoundState => state;
export function useSoundState(): SoundState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    soundState,
    soundState,
  );
}

/** The Settings line for a sound state (round 184). */
export function soundCheckText(s: SoundState, fmt: (at: number) => string): string {
  switch (s.kind) {
    case 'idle':
      return 'Sound check: not loaded yet.';
    case 'loading':
      return 'Sound check: loading the sound…';
    case 'failed':
      return `Sound check: the sound couldn't load (${s.detail}).`;
    case 'ready':
      if (s.playing) return 'Sound check: playing now.';
      return s.playedAt ? `Sound check: loaded, last played ${fmt(s.playedAt)}.` : 'Sound check: loaded, not played yet.';
  }
}

let loading: Promise<AudioPlayer | null> | null = null;
let moan: AudioPlayer | null = null;
let moanTimer: ReturnType<typeof setTimeout> | null = null;
let playedAt: number | null = null;

const fail = (e: unknown) => setState({ kind: 'failed', detail: e instanceof Error ? e.message : String(e) });

/**
 * Round 184 (still silent after round 183): the audio mode is set and waited for before the player
 * is made, so the first play never runs ahead of it. The sound now plays even with the phone on
 * silent (the playback category, mixed with other audio, so music keeps going); the Sound effects
 * switch is the way to turn it off.
 */
function ready(): Promise<AudioPlayer | null> {
  if (loading) return loading;
  setState({ kind: 'loading' });
  loading = (async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
      const p = createAudioPlayer(answerSoundSource());
      // The moan is its own player; if it can't load, the fart still plays.
      try {
        moan = createAudioPlayer(moanSource());
      } catch {
        moan = null;
      }
      p.addListener?.('playbackStatusUpdate', (st) => {
        if (st.error) fail(st.error);
        else if (st.isLoaded) setState({ kind: 'ready', playedAt, playing: !!st.playing });
      });
      return p;
    } catch (e) {
      fail(e);
      loading = null;
      return null;
    }
  })();
  return loading;
}

/** Loads the sound ahead of time (round 182), so the first answer plays it right away. */
export function preloadSounds(): void {
  void ready();
}

export async function playAnswerSound(): Promise<void> {
  // A tap you can feel with every sound (round 184), even where sound can't play.
  successTap();
  const p = await ready();
  if (!p) return;
  try {
    // Only rewind a player that has already played (round 182).
    if (p.currentTime > 0) await p.seekTo(0).catch(() => {});
    p.play();
    playedAt = Date.now();
    // Then the moan, once the fart is done (round 195).
    if (moanTimer) clearTimeout(moanTimer);
    const m = moan;
    if (m) {
      moanTimer = setTimeout(() => {
        moanTimer = null;
        try {
          if (m.currentTime > 0) void m.seekTo(0).catch(() => {});
          m.play();
        } catch {
          // A missed moan is fine.
        }
      }, MOAN_AFTER_MS);
    }
    if (state.kind === 'ready') setState({ kind: 'ready', playedAt, playing: true });
  } catch (e) {
    fail(e);
  }
}

/** For tests: forget the player, audio mode and state. */
export function resetSounds(): void {
  loading = null;
  moan = null;
  if (moanTimer) clearTimeout(moanTimer);
  moanTimer = null;
  playedAt = null;
  state = { kind: 'idle' };
}
