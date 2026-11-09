import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Sound effects (round 181). John: "add a yaoom sound effect when a request is answered". The yaoom is
 * an original sound made for OutBound (assets/sounds/yaoom.wav); no artist's audio is used.
 *
 * It follows the phone's silent switch (playsInSilentMode false) and plays over whatever else is on
 * (mixWithOthers), so it never stops someone's music. Never throws: a missed sound is fine.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YAOOM = require('../../assets/sounds/yaoom.wav');

let player: AudioPlayer | null = null;
let modeSet = false;

function ready(): AudioPlayer {
  if (!modeSet) {
    modeSet = true;
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }
  if (!player) player = createAudioPlayer(YAOOM);
  return player;
}

/**
 * Loads the yaoom ahead of time (round 182), so the first answer plays it right away instead of
 * waiting on a cold load. Called once when the app starts.
 */
export function preloadSounds(): void {
  try {
    ready();
  } catch {
    // No audio here: stay quiet.
  }
}

export function playYaoom(): void {
  try {
    const p = ready();
    // Round 182: only rewind a player that has already played. Seeking a player that's still
    // loading could hold up (or drop) the first play.
    if (p.currentTime > 0) {
      p.seekTo(0)
        .catch(() => {})
        .then(() => p.play());
    } else {
      p.play();
    }
  } catch {
    // No audio on this device or in this build: stay quiet.
  }
}

/** For tests: forget the player and audio mode. */
export function resetSounds(): void {
  player = null;
  modeSet = false;
}
