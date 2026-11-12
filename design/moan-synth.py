# The relieved moan that follows the fart (round 195, John: "add a separate moan noise"). A comedic, tired
# "uhhh-ahhhh" of relief, nothing more: a breathy voice sliding down from about 190 Hz to 105 Hz, the vowel
# moving from "uh" to "ah", with a little wobble and a sigh of breath at the end. An original synthesized voice.
# Run: python3 design/moan-synth.py design/moan-source.wav
import numpy as np, wave, sys
rng = np.random.default_rng(1952)
sr = 44100; dur = 1.7; n = int(sr * dur); t = np.arange(n) / sr

def reson(x, F, bw):
    y = np.zeros_like(x); y1 = y2 = 0.0; r = np.exp(-np.pi * bw / sr)
    Fa = np.broadcast_to(F, x.shape)
    for i in range(len(x)):
        c = 2 * r * np.cos(2 * np.pi * Fa[i] / sr); yi = (1 - r) * x[i] + c * y1 - r * r * y2; y[i] = yi; y2 = y1; y1 = yi
    return y

# Pitch: a small rise on "uh", then the long falling "ahhh".
f0 = np.interp(t, [0, 0.12, 0.30, 1.1, 1.5, 1.7], [150, 185, 175, 128, 108, 100])
f0 = f0 * (1 + 0.018 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.35) / 0.3, 0, 1))
ph = 2 * np.pi * np.cumsum(f0) / sr
# A soft glottal pulse (rounded, so it's a voice, not a buzz) with harmonics rolling off.
src = np.zeros(n)
for k in range(1, 40):
    m = (k * f0 < 6000).astype(float)
    src += m * np.sin(k * ph) / k ** 1.0
breath = rng.normal(0, 1, n)
breathiness = np.interp(t, [0, 0.1, 0.4, 1.2, 1.5, 1.7], [0.6, 0.25, 0.18, 0.25, 0.7, 0.9])
voiced = np.interp(t, [0, 0.04, 1.35, 1.6, 1.7], [0, 1, 1, 0.15, 0])
excite = voiced * src + breathiness * 0.35 * breath

# Vowel: "uh" (F1 620, F2 1200) to "ah" (F1 760, F2 1120), with F3 steady.
F1 = np.interp(t, [0, 0.2, 0.45, 1.7], [560, 620, 760, 720])
F2 = np.interp(t, [0, 0.2, 0.45, 1.7], [1250, 1200, 1120, 1080])
v = reson(excite, F1, 90) + 1.1 * reson(excite, F2, 110) + 0.7 * reson(excite, np.full(n, 2500.0), 180)
v = v - 0.6 * np.convolve(v, np.ones(200) / 200, mode="same")  # less boom, so it carries on a phone speaker
env = np.clip(t / 0.05, 0, 1) * np.interp(t, [0, 0.2, 1.0, 1.45, 1.7], [0.8, 1.0, 0.9, 0.55, 0.0])
out = v * env
out *= 10 ** (-1.5 / 20) / np.max(np.abs(out))
w = wave.open(sys.argv[1], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((out * 32767).astype('<i2').tobytes()); w.close()
print(f'moan {dur}s')
