# The OutBound fart (round 194, John: "do a fart sound effect"; round 195: "It just sounds like distorted bass.
# Can you make it more of a fart"). An original sound, synthesized here.
# A real one is a flapping valve: a train of separate, irregular puffs (40 to 140 a second), each a short
# brassy "buzz" ringing in the mids, with wet crackle and air between them. So: no smooth bass tone. Each puff
# is its own little burst through mid resonances, the spacing jitters, it stalls and sputters, and it ends in
# a few slow, wet flaps and a tiny squeak.
# Run: python3 design/fart-synth.py design/fart-source.wav
import numpy as np, wave, sys
rng = np.random.default_rng(1951)
sr = 44100

def reson(x, F, bw):
    y = np.zeros_like(x); y1 = y2 = 0.0; r = np.exp(-np.pi * bw / sr); c = 2 * r * np.cos(2 * np.pi * F / sr)
    for i in range(len(x)):
        yi = (1 - r) * x[i] + c * y1 - r * r * y2; y[i] = yi; y2 = y1; y1 = yi
    return y
def onepole(x, fc, high=False):
    y = np.empty_like(x); a = np.exp(-2 * np.pi * fc / sr); s = 0.0
    for i in range(len(x)):
        s = a * s + (1 - a) * x[i]; y[i] = s
    return x - y if high else y

# The puff rate over time (puffs a second) and how hard each puff is.
plan = [  # (start s, end s, rate from, rate to, loudness)
    (0.00, 0.07, 30, 55, 0.6),    # a couple of slow opening flaps
    (0.07, 0.55, 95, 120, 1.0),   # the main brassy rip
    (0.55, 0.62, 0, 0, 0.0),      # catches
    (0.62, 0.95, 80, 60, 0.9),    # second push, lower
    (0.95, 1.20, 38, 22, 0.75),   # slows into wet, separate flaps
    (1.22, 1.34, 150, 190, 0.35), # a tiny squeak to finish
]
dur = 1.42; n = int(sr * dur)
pulses = np.zeros(n); amps = []
for (a, b, r0, r1, loud) in plan:
    if loud == 0: continue
    t = a
    while t < b:
        frac = (t - a) / (b - a)
        rate = r0 + (r1 - r0) * frac
        i = int(t * sr)
        if i < n:
            # Uneven puffs: some strong, some weak, a few doubled.
            pulses[i] += loud * rng.uniform(0.55, 1.0)
            if rng.random() < 0.12 and i + 40 < n: pulses[i + 40] += loud * 0.5
        t += (1 / rate) * rng.uniform(0.75, 1.3)

# Each puff rings through the mid "brass" resonances (cheeks and valve), never a low hum.
burst = 0.9 * reson(pulses, 330, 90) + 1.0 * reson(pulses, 620, 140) + 0.7 * reson(pulses, 1150, 260) + 0.35 * reson(pulses, 2300, 500)
# Air pushed through with every puff, plus a steady hiss under it.
noise = rng.normal(0, 1, n)
gate = onepole(np.abs(pulses) > 0, 60)  # where the puffs are dense
gate = gate / (gate.max() or 1)
air = onepole(onepole(noise, 3500), 250, high=True) * (0.15 + 0.85 * gate)
# Wet: random tiny crackles and bubbles, thicker in the slow flaps at the end.
t = np.arange(n) / sr
wet_rate = np.interp(t, [0, 0.9, 1.0, 1.2, 1.42], [25, 35, 120, 160, 20])
pops = (rng.random(n) < wet_rate / sr).astype(float) * rng.uniform(0.3, 1.0, n)
wet = reson(pops, 1800, 600) + 0.6 * reson(pops, 900, 300)

v = burst / np.max(np.abs(burst)) + 0.22 * air / np.max(np.abs(air)) + 0.25 * wet / np.max(np.abs(wet))
v = onepole(v, 110, high=True)  # nothing down in bass territory
env = np.clip(t / 0.01, 0, 1) * np.clip((dur - t) / 0.05, 0, 1)
out = np.tanh(1.6 * v * env / np.max(np.abs(v)))
out *= 10 ** (-1 / 20) / np.max(np.abs(out))
w = wave.open(sys.argv[1], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((out * 32767).astype('<i2').tobytes()); w.close()
print(f'fart {dur}s')
