# OutBound's sound set (round 197, John: "remove the current sound effects ... redo some sound effects that
# would make sense on this app and keep it subtle to very key specific actions"). Three soft, short, original
# bell tones, made here from sine partials (no one else's audio):
#   answered  two notes rising (E5 then B5): a request you made got its loads back
#   sent      one light high tap (A5): your load request went out
#   leave     three notes falling (G5, E5, C5), like a gentle terminal chime: it's time to leave for the airport
# All mixed well under full scale (peak -14 dBFS) so they sit under music and never blare.
# Run: python3 design/chimes-synth.py design/sounds   (writes answered.wav, sent.wav, leave.wav there)
import numpy as np, wave, sys, os
sr = 44100

# A soft bell: a pure fundamental, a quiet octave and a faint inharmonic shimmer, each fading at its own pace.
PARTIALS = [(1.0, 1.0, 1.0), (2.0, 0.22, 1.6), (2.76, 0.06, 2.4), (4.07, 0.025, 3.2)]

def bell(freq, dur, decay):
    t = np.arange(int(sr * dur)) / sr
    x = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * decay * d) for r, a, d in PARTIALS)
    attack = np.clip(t / 0.006, 0, 1)  # 6 ms in, so it never clicks
    tail = np.clip((dur - t) / 0.04, 0, 1)  # 40 ms out
    return x * attack * tail

def place(notes, total):
    out = np.zeros(int(sr * total))
    for start, freq, dur, decay, gain in notes:
        b = bell(freq, dur, decay) * gain
        i = int(sr * start)
        out[i:i + len(b)] += b[: len(out) - i]
    return out

def save(path, x, peak_db=-14):
    x = x * (10 ** (peak_db / 20) / np.max(np.abs(x)))
    w = wave.open(path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((x * 32767).astype('<i2').tobytes()); w.close()

E5, G5, A5, B5, C5 = 659.25, 783.99, 880.0, 987.77, 523.25
out = sys.argv[1]
save(os.path.join(out, 'answered.wav'), place([(0.0, E5, 0.9, 4.5, 0.9), (0.13, B5, 1.0, 4.0, 1.0)], 1.15))
save(os.path.join(out, 'sent.wav'), place([(0.0, A5, 0.35, 11.0, 1.0)], 0.35), peak_db=-17)
save(os.path.join(out, 'leave.wav'), place([(0.0, G5, 0.7, 4.5, 1.0), (0.24, E5, 0.7, 4.5, 0.95), (0.48, C5, 1.0, 3.5, 0.95)], 1.5))
print('answered, sent, leave')
