import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { successTap } from './haptics';
import { ANSWERED_DATA_URI, LEAVE_DATA_URI, SENT_DATA_URI } from './soundData';

/**
 * Sound effects (round 181 onward). Round 197, John: "remove the current sound effects loaded on the app. Lets
 * redo some sound effects that would make sense on this app and keep it subtle to very key specific actions."
 * The fart and the moan are gone. Three soft, short, original bell tones (design/chimes-synth.py), each on one
 * key moment only:
 *   answered  two notes rising: a load request you made got its answer
 *   sent      one light tap: your load request went out
 *   leave     three notes falling: the Leave By card turns to Leave now while you're looking at it
 * Nothing else makes a sound. They're mixed quiet in the files themselves.
 *
 * They play over whatever else is on (mixWithOthers), so they never stop someone's music. Never throws:
 * a missed sound is fine.
 *
 * Round 183, John: "my phone is not muted I cant hear it". Rounds 181 and 182 loaded the sound as a
 * bundled file. In Expo Go an update keeps its files under bare content hashes with no file extension,
 * and iPhone's player can't tell what such a file is, so it most likely never loaded. On iPhone the
 * sounds come from data URIs (AAC, audio/mp4): expo-audio writes each to a temp file that ends in
 * a real audio extension, which the player recognizes. Android uses the bundled files.
 *
 * Whether they loaded is kept (useSoundState), so Settings can say so if it ever fails again.
 */
export type SoundName = 'answered' | 'sent' | 'leave';
export const SOUND_NAMES: readonly SoundName[] = ['answered', 'sent', 'leave'];

const FILES: Record<SoundName, number> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  answered: require('../../assets/sounds/answered.m4a'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sent: require('../../assets/sounds/sent.m4a'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  leave: require('../../assets/sounds/leave.m4a'),
};
const URIS: Record<SoundName, string> = { answered: ANSWERED_DATA_URI, sent: SENT_DATA_URI, leave: LEAVE_DATA_URI };

export const soundSource = (name: SoundName, os: string = Platform.OS): AudioSource | number =>
  os === 'ios' ? { uri: URIS[name] } : FILES[name];

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

type Players = Partial<Record<SoundName, AudioPlayer>>;
let loading: Promise<Players | null> | null = null;
let playedAt: number | null = null;
// When each sound last started, so the same one never stacks up (several cards can flip at once) and the
// answered chime waits for the sent tap to finish rather than landing on top of it.
let lastAt: Partial<Record<SoundName, number>> = {};
/** The same sound twice within this long plays once. */
export const SAME_SOUND_GAP_MS = 2000;
/** The answered chime starts at least this long after a sent tap (the demo answers a request at once). */
export const AFTER_SENT_MS = 450;

const fail = (e: unknown) => setState({ kind: 'failed', detail: e instanceof Error ? e.message : String(e) });

/**
 * Round 184 (still silent after round 183): the audio mode is set and waited for before the players
 * are made, so the first play never runs ahead of it. Sounds play even with the phone on silent (the
 * playback category, mixed with other audio, so music keeps going); the Sound effects switch is the way
 * to turn them off. One player per sound; one that can't load leaves the others working.
 */
function ready(): Promise<Players | null> {
  if (loading) return loading;
  setState({ kind: 'loading' });
  loading = (async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
      const players: Players = {};
      for (const name of SOUND_NAMES) {
        try {
          const p = createAudioPlayer(soundSource(name));
          // Settings' sound check follows the answered chime, the one its switch plays.
          if (name === 'answered') {
            p.addListener?.('playbackStatusUpdate', (st) => {
              if (st.error) fail(st.error);
              else if (st.isLoaded) setState({ kind: 'ready', playedAt, playing: !!st.playing });
            });
          }
          players[name] = p;
        } catch (e) {
          if (name === 'answered') throw e;
        }
      }
      return players;
    } catch (e) {
      fail(e);
      loading = null;
      return null;
    }
  })();
  return loading;
}

/** Loads the sounds ahead of time (round 182), so the first one plays right away. */
export function preloadSounds(): void {
  void ready();
}

/** Plays one of the chimes. The answered chime comes with a tap you can feel (round 184). */
export async function playSound(name: SoundName): Promise<void> {
  const now = Date.now();
  const last = lastAt[name];
  if (last != null && now - last < SAME_SOUND_GAP_MS) return;
  lastAt[name] = now;
  if (name === 'answered') successTap();
  const players = await ready();
  const p = players?.[name];
  if (!p) return;
  const sentAt = lastAt.sent;
  const wait = name === 'answered' && sentAt != null ? sentAt + AFTER_SENT_MS - Date.now() : 0;
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  try {
    // Only rewind a player that has already played (round 182).
    if (p.currentTime > 0) await p.seekTo(0).catch(() => {});
    p.play();
    if (name === 'answered') {
      playedAt = Date.now();
      if (state.kind === 'ready') setState({ kind: 'ready', playedAt, playing: true });
    }
  } catch (e) {
    if (name === 'answered') fail(e);
  }
}

/** For tests: forget the players, audio mode and state. */
export function resetSounds(): void {
  loading = null;
  playedAt = null;
  lastAt = {};
  state = { kind: 'idle' };
}
