import numpy as np, wave, sys
sr=44100; dur=2.4; n=int(sr*dur); t=np.arange(n)/sr
# Sung pitch: starts up on the "y", drifts down over the long ooo with a wide vibrato,
# then gets autotuned: snapped to E minor pentatonic with a near-instant retune, so the
# vibrato flips between notes (the robotic warble) instead of sliding.
semi=lambda f: 12*np.log2(f/440)
raw=semi(330)+(semi(185)-semi(330))*np.clip(t/2.1,0,1)**0.8
vibdepth=2.6*np.clip((t-0.18)/0.25,0,1)
raw=raw+vibdepth*np.sin(2*np.pi*6.2*t)+0.8*np.sin(2*np.pi*2.1*t)
scale=np.array([0,3,5,7,10])  # E minor pentatonic, relative to E
rel=raw-semi(329.63)
octv=np.floor(rel/12); pc=rel-12*octv
cands=np.concatenate([scale,[12]])
q=cands[np.argmin(np.abs(pc[:,None]-cands[None,:]),axis=1)]+12*octv+semi(329.63)
# retune speed: ~5 ms glide between notes
a=np.exp(-1/(sr*0.001)); sm=np.empty(n); s=q[0]
for i in range(n): s=a*s+(1-a)*q[i]; sm[i]=s
f0=440*2**(sm/12)
def voice(f0,detune=0.0):
    f=f0*2**(detune/1200); ph=2*np.pi*np.cumsum(f)/sr; src=np.zeros(n)
    for k in range(1,60):
        m=(k*f<8000).astype(float); src+=m*np.sin(k*ph)/k**0.8
    return src
f5=f0*2**(7/12)
src=voice(f0)+0.35*voice(f0,+12)+0.35*voice(f0,-12)+0.45*voice(f5)   # light doubling, processed-vocal feel
# y glides straight into oo (no "a"), holds, closes into m
keys=[(0.0,270,2300),(0.14,330,900),(0.3,340,780),(1.7,340,800),(2.0,290,700),(2.4,250,680)]
kt=[k[0] for k in keys]
F1=np.interp(t,kt,[k[1] for k in keys]); F2=np.interp(t,kt,[k[2] for k in keys]); F3=np.full(n,2700.0)
def reson(x,F,bw):
    y=np.zeros_like(x); y1=y2=0.0; r=np.exp(-np.pi*bw/sr)
    for i in range(len(x)):
        c=2*r*np.cos(2*np.pi*F[i]/sr); yi=(1-r)*x[i]+c*y1-r*r*y2; y[i]=yi; y2=y1; y1=yi
    return y
v=reson(src,F1,80)+0.55*reson(src,F2,110)+0.32*reson(src,F3,160)
mt=np.clip((t-1.8)/0.35,0,1); v=v*(1-0.65*mt)
v/=np.max(np.abs(v))
sub=np.sin(2*np.pi*np.cumsum(np.interp(t,[0,2.4],[68,44]))/sr)*np.clip((t-0.1)/0.06,0,1)*np.exp(-np.clip(t-0.18,0,None)*1.1)
env=np.clip(t/0.02,0,1)*np.where(t<1.6,1.0,np.exp(-(t-1.6)*2.6))*np.clip((dur-t)/0.08,0,1)
out=(0.8*v+0.45*sub)*env
out*=10**(-1/20)/np.max(np.abs(out))
w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((out*32767).astype('<i2').tobytes()); w.close()
# report the tuned notes over time
names=['E','F','F#','G','G#','A','A#','B','C','C#','D','D#']
for tt in np.arange(0,2.4,0.1):
    i=int(tt*sr); st=sm[i]-semi(329.63); print(f"{tt:.1f}s {f0[i]:6.1f}Hz {names[int(round(st))%12]}")
