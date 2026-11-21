"""Block-based stereo synthesizer. Audio I/O is optional for offline rendering/tests."""
import json, math, threading
from pathlib import Path
import numpy as np
from scipy.signal import lfilter, fftconvolve
from theory import frequency

DATA = json.loads(Path(__file__).with_name('presets.json').read_text())
DEFAULTS = DATA['defaults']
PRESETS = DATA['presets']

class Voice:
    def __init__(self, note, velocity, p, sr, previous=None):
        self.note, self.velocity, self.sr = note, velocity, sr
        self.age = 0; self.released = None; self.release_level = 0
        self.phases = np.zeros(6); self.filter_state = np.zeros((2,2,2))
        self.previous = previous
    def envelope(self, t, p):
        a=max(.001,p['attack']); d=max(.001,p['decay'])
        return np.where(t<a,t/a, p['sustain']+(1-p['sustain'])*np.exp(-(t-a)/d))
    def off(self, p):
        if self.released is None:
            self.released=self.age; self.release_level=float(self.envelope(np.array([self.age/self.sr]),p)[0])
    def render(self, n, p):
        sr=self.sr; t=(self.age+np.arange(n))/sr
        env=self.envelope(t,p)
        if self.released is not None:
            env=self.release_level*np.exp(-np.maximum(0,(self.age+np.arange(n)-self.released)/sr)/max(.005,p['release']/4))
        target=frequency(self.note+12*p['octave'])
        if self.previous and p['glide'] > 0:
            f=self.previous*(target/self.previous)**np.minimum(1,t/p['glide'])
        else: f=np.full(n,target)
        audio=np.zeros((n,2)); count=int(p['unison'])
        for i in range(count+1):
            pos=0 if count==1 else 2*i/(count-1)-1
            hz=f*.5 if i==count else f*2**((p['detune']+pos*p['spread'])/1200)
            phase=(self.phases[i]+np.cumsum(hz)/sr)%1; self.phases[i]=phase[-1]
            if i==count: wave=np.sin(2*np.pi*phase)*p['sub']*.8; pan=0
            else:
                wave={'sine':lambda:np.sin(2*np.pi*phase),'square':lambda:np.where(phase<.5,1.,-1.),'sawtooth':lambda:2*phase-1,'triangle':lambda:1-4*np.abs(phase-.5)}[p['waveform']]()*.85/math.sqrt(count)
                pan=pos*.65
            audio[:,0]+=wave*math.sqrt((1-pan)/2); audio[:,1]+=wave*math.sqrt((1+pan)/2)
        base=p['cutoff']*2**((self.note-60)/12*p['keyTrack'])
        cutoff=np.clip(base*2**(p['filterEnv']*4*float(env[n//2])) + base*p['lfoDepth']*.55*math.sin(2*math.pi*p['lfoRate']*t[n//2]),20,sr*.45)
        # RBJ low-pass, with state preserved across blocks.
        for stage in range(2 if p['slope']==24 else 1):
            q=max(.1,p['resonance']*(.55 if stage else 1)); w=2*math.pi*cutoff/sr; alpha=math.sin(w)/(2*q); c=math.cos(w)
            b=np.array([(1-c)/2,1-c,(1-c)/2])/(1+alpha); a=np.array([1,-2*c/(1+alpha),(1-alpha)/(1+alpha)])
            for ch in range(2): audio[:,ch],self.filter_state[stage,ch]=lfilter(b,a,audio[:,ch],zi=self.filter_state[stage,ch])
        self.age+=n
        return audio*env[:,None]*max(.05,min(1,self.velocity))*.3
    def dead(self,p): return self.released is not None and (self.age-self.released)/self.sr > max(.02,p['release']*2)

class SynthEngine:
    def __init__(self, sample_rate=44100):
        self.sr=sample_rate; self.params=DEFAULTS.copy(); self.voices=[]; self.lock=threading.RLock(); self.stream=None; self.previous=None
        self.delay=np.zeros((int(sample_rate*2)+1,2)); self.delay_pos=0
        rng=np.random.default_rng(24); length=int(sample_rate*2.6); times=np.arange(length)/sample_rate
        impulse=rng.normal(0,1,(length,2))*(1-times[:,None]/2.6)**2.7
        for sec,gain in [(0.011,.7),(.023,.55),(.037,.4),(.053,.3),(.071,.25),(.089,.2),(.109,.15),(.137,.1),(.173,.08)]: impulse[int(sec*sample_rate)]+=gain*20
        self.ir=impulse/(np.sqrt(np.sum(impulse**2,axis=0))*3); self.reverb_tail=np.zeros((length-1,2))
        self.latest=np.zeros((1024,2)); self.level=0
    def start(self):
        if self.stream: return
        import sounddevice as sd
        self.stream=sd.OutputStream(samplerate=self.sr,channels=2,blocksize=512,callback=self._callback)
        try: self.stream.start()
        except Exception: self.stream.close(); self.stream=None; raise
    def close(self):
        if self.stream: self.stream.stop(); self.stream.close(); self.stream=None
    def _callback(self,outdata,frames,time_info,status): outdata[:]=self.render(frames)
    def set_param(self,key,value):
        with self.lock: self.params[key]=value
    def preset(self,index):
        with self.lock: self.params=DEFAULTS.copy() | PRESETS[index]['params']
    def note_on(self,note,velocity=.82):
        with self.lock:
            if len(self.voices)>=16: self.voices.pop(0)
            self.voices.append(Voice(note,velocity,self.params,self.sr,self.previous)); self.previous=frequency(note+12*self.params['octave'])
    def note_off(self,note):
        with self.lock:
            for v in self.voices:
                if v.note==note: v.off(self.params)
    def panic(self):
        with self.lock: self.voices.clear(); self.delay.fill(0); self.reverb_tail.fill(0)
    def render(self,n):
        with self.lock:
            p=self.params.copy(); audio=np.zeros((n,2))
            for v in self.voices: audio+=v.render(n,p)
            self.voices=[v for v in self.voices if not v.dead(p)]
            drive=1+p['drive']*20; audio=np.tanh(audio*drive)/math.tanh(drive)
            dry=audio.copy(); delay_n=max(1,min(len(self.delay)-1,int(p['delayTime']*self.sr)))
            # Delay may be shorter than a block, so process contiguous ring segments.
            done=0
            while done<n:
                read=(self.delay_pos-delay_n)%len(self.delay); size=min(n-done,delay_n,len(self.delay)-read,len(self.delay)-self.delay_pos)
                delayed=self.delay[read:read+size].copy(); self.delay[self.delay_pos:self.delay_pos+size]=dry[done:done+size]+delayed*p['delayFb']
                audio[done:done+size]+=delayed*p['delayMix']; self.delay_pos=(self.delay_pos+size)%len(self.delay); done+=size
            # Partitioned by callback blocks via overlap-add, preserving a true convolution tail.
            wet=np.empty_like(audio); tail_len=len(self.reverb_tail)
            for ch in range(2):
                conv=fftconvolve(dry[:,ch],self.ir[:,ch]); conv[:tail_len]+=self.reverb_tail[:,ch]; wet[:,ch]=conv[:n]; self.reverb_tail[:,ch]=conv[n:n+tail_len]
            audio=(audio+wet*p['reverbMix'])*p['master']
            if p['limiter']: audio=np.tanh(audio)
            audio=np.clip(audio,-1,1); self.level=float(np.max(np.abs(audio))); self.latest=audio.copy()
            return audio.astype(np.float32)
