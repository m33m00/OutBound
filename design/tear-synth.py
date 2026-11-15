# The ticket tear (round 220, John: "when I save a ticket and it tears can you have a sound effect for that").
# A short, soft paper rip made here from filtered noise (no one else's audio): many tiny fiber snaps that bunch
# up and thin out over about a third of a second, band-limited so it reads as paper, not static. Mixed quiet
# (peak -19 dBFS) like the chimes, so it sits under music.
# Run: python3 design/tear-synth.py design/sounds   (writes tear.wav there)
import numpy as np, wave, sys, os

sr = 44100
rng = np.random.default_rng(220)
dur = 0.38
n = int(sr * dur)
t = np.arange(n) / sr

def band(x, lo, hi):
    f = np.fft.rfftfreq(len(x), 1 / sr)
    X = np.fft.rfft(x)
    X *= np.clip((f - lo) / 300, 0, 1) * np.clip((hi - f) / 1500, 0, 1)
    return np.fft.irfft(X, len(x))

# Fiber snaps: short clicks scattered with a density that swells and fades, like a tear running across.
density = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
snaps = np.zeros(n)
for i in np.nonzero(rng.random(n) < 0.012 * density)[0]:
    k = min(n - i, 90)
    snaps[i : i + k] += rng.uniform(0.4, 1.0) * np.exp(-np.arange(k) / rng.uniform(8, 25)) * rng.choice([-1, 1])
# A soft bed of rustle under them.
bed = rng.normal(0, 0.18, n) * density
x = band(snaps, 1800, 7500) + band(bed, 1200, 5000)
# The rip rises in pitch a little as it runs: a gentle bright lift toward the end.
x += band(rng.normal(0, 0.08, n) * density * (t / dur), 4000, 9000)
x *= np.clip(t / 0.008, 0, 1) * np.clip((dur - t) / 0.06, 0, 1)

def save(path, x, peak_db=-19):
    x = x * (10 ** (peak_db / 20) / np.max(np.abs(x)))
    w = wave.open(path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((x * 32767).astype('<i2').tobytes()); w.close()

save(os.path.join(sys.argv[1], 'tear.wav'), x)
print('tear')
