import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { YAOOM_DATA_URI } from './yaoomData';

/**
 * Sound effects (round 181). John: "add a yaoom sound effect when a request is answered". The yaoom is
 * an original sound made for OutBound (design/yaoom-source.wav); no artist's audio is used.
 *
 * It follows the phone's silent switch (playsInSilentMode false) and plays over whatever else is on
 * (mixWithOthers), so it never stops someone's music. Never throws: a missed sound is fine.
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
const YAOOM_FILE = require('../../assets/sounds/yaoom.m4a');

export const yaoomSource = (os: string = Platform.OS): AudioSource | number =>
  os === 'ios' ? { uri: YAOOM_DATA_URI } : YAOOM_FILE;

export type SoundState = { kind: 'idle' | 'loading' | 'ready' } | { kind: 'failed'; detail: string };

let state: SoundState = { kind: 'idle' };
const listeners = new Set<() => void>();
function setState(next: SoundState) {
  const same = next.kind === state.kind && (next.kind !== 'failed' || (state.kind === 'failed' && state.detail === next.detail));
  if (same) return;
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

let player: AudioPlayer | null = null;
let modeSet = false;

function ready(): AudioPlayer | null {
  if (player) return player;
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    setState({ kind: 'loading' });
    const p = createAudioPlayer(yaoomSource());
    p.addListener?.('playbackStatusUpdate', (s) => {
      if (s.error) setState({ kind: 'failed', detail: s.error });
      else if (s.isLoaded) setState({ kind: 'ready' });
    });
    player = p;
    return p;
  } catch (e) {
    setState({ kind: 'failed', detail: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** Loads the yaoom ahead of time (round 182), so the first answer plays it right away. */
export function preloadSounds(): void {
  ready();
}

export function playYaoom(): void {
  const p = ready();
  if (!p) return;
  try {
    // Only rewind a player that has already played (round 182).
    if (p.currentTime > 0) {
      p.seekTo(0)
        .catch(() => {})
        .then(() => p.play());
    } else {
      p.play();
    }
  } catch (e) {
    setState({ kind: 'failed', detail: e instanceof Error ? e.message : String(e) });
  }
}

/** For tests: forget the player, audio mode and state. */
export function resetSounds(): void {
  player = null;
  modeSet = false;
  state = { kind: 'idle' };
}
