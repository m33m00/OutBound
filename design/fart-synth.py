# The OutBound fart (round 194, John: "Remove the yaoom sound effect and do a fart sound effect").
# An original sound, synthesized here: a buzzy low tone pulsed by a flapping "valve", with a wobbly pitch,
# some breath noise, a sputter in the middle and a short squeaky rise at the end.
# Run: python3 design/fart-synth.py design/fart-source.wav
import numpy as np, wave, sys
rng = np.random.default_rng(194)
sr = 44100; dur = 1.35; n = int(sr * dur); t = np.arange(n) / sr

# Pitch: starts around 120 Hz, sags to ~72 Hz, sputters, then a quick squeaky rise to ~210 Hz to finish.
keys_t = [0.00, 0.08, 0.45, 0.70, 0.78, 0.86, 1.05, 1.18, 1.30, 1.35]
keys_f = [95, 122, 92, 74, 98, 70, 78, 150, 210, 190]
f0 = np.interp(t, keys_t, keys_f)
# Wobble: slow drift plus fast jitter, smoothed so it flutters instead of crackles.
jit = rng.normal(0, 1, n)
a = np.exp(-1 / (sr * 0.004)); sm = np.empty(n); s = 0.0
for i in range(n):
    s = a * s + (1 - a) * jit[i]; sm[i] = s
sm /= np.max(np.abs(sm))
f0 = f0 * (1 + 0.10 * np.sin(2 * np.pi * 7.5 * t) + 0.18 * sm)
ph = 2 * np.pi * np.cumsum(f0) / sr

# The valve: a narrow pulse train at f0 (buzzy, lots of low harmonics) rather than a clean sine.
pulse = np.maximum(0, np.cos(ph)) ** 6
buzz = pulse - np.mean(pulse)

# Flap: the amplitude chops on and off at 18 to 32 Hz, with a stall in the middle (the sputter).
flap_f = np.interp(t, [0, 0.6, 0.75, 0.9, 1.35], [24, 30, 18, 26, 32])
flap = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * np.cumsum(flap_f) / sr)) * 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(flap_f) / sr)
flap = np.clip(flap, 0, 1)
gap = 1 - 0.85 * np.exp(-((t - 0.74) / 0.025) ** 2)  # a little hitch before the second push

# Breath noise, low-passed, so it's wet and airy rather than hissy.
noise = rng.normal(0, 1, n)
def lowpass(x, fc):
    y = np.empty_like(x); a = np.exp(-2 * np.pi * fc / sr); s = 0.0
    for i in range(len(x)):
        s = a * s + (1 - a) * x[i]; y[i] = s
    return y
air = lowpass(noise, 900) * (0.25 + 0.6 * pulse)

def reson(x, F, bw):
    y = np.zeros_like(x); y1 = y2 = 0.0; r = np.exp(-np.pi * bw / sr); c = 2 * r * np.cos(2 * np.pi * F / sr)
    for i in range(len(x)):
        yi = (1 - r) * x[i] + c * y1 - r * r * y2; y[i] = yi; y2 = y1; y1 = yi
    return y
# A body to it: a low cavity resonance and a mid "rasp".
v = buzz + 0.35 * air
v = 1.0 * reson(v, 160, 120) + 0.55 * reson(v, 420, 220) + 0.25 * reson(v, 1100, 400) + 0.35 * lowpass(v, 300)
v = v * flap * gap

env = np.clip(t / 0.015, 0, 1) * np.interp(t, [0, 0.1, 0.6, 1.0, 1.25, 1.35], [0.7, 1.0, 0.9, 0.75, 0.8, 0.0])
out = np.tanh(2.2 * v * env / np.max(np.abs(v)))  # soft clip for the raspy edge
out *= 10 ** (-1 / 20) / np.max(np.abs(out))
w = wave.open(sys.argv[1], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((out * 32767).astype('<i2').tobytes()); w.close()
print(f'{dur}s, pitch {min(keys_f)} to {max(keys_f)} Hz')
