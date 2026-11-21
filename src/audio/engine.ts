import { midiToFreq } from "./theory";

export type Waveform = "sine" | "square" | "sawtooth" | "triangle";

export interface SynthParams {
  waveform: Waveform;
  octave: number; // oscillator octave -2..2
  detune: number; // cents
  unison: number; // 1..5
  spread: number; // cents of unison spread
  sub: number; // sub oscillator level
  glide: number; // seconds
  cutoff: number; // Hz
  resonance: number; // Q
  filterEnv: number; // -1..1 (x4 octaves)
  keyTrack: number; // 0..1
  slope: 12 | 24; // dB / octave
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  lfoRate: number;
  lfoDepth: number;
  drive: number;
  delayMix: number;
  delayTime: number;
  delayFb: number;
  reverbMix: number;
  master: number;
  limiter: boolean;
}

export const DEFAULT_PARAMS: SynthParams = {
  waveform: "sawtooth",
  octave: 0,
  detune: 0,
  unison: 3,
  spread: 14,
  sub: 0.25,
  glide: 0,
  cutoff: 2600,
  resonance: 6,
  filterEnv: 0.42,
  keyTrack: 0.35,
  slope: 24,
  attack: 0.012,
  decay: 0.55,
  sustain: 0.45,
  release: 0.7,
  lfoRate: 0.7,
  lfoDepth: 0.06,
  drive: 0.22,
  delayMix: 0.22,
  delayTime: 0.32,
  delayFb: 0.36,
  reverbMix: 0.3,
  master: 0.72,
  limiter: true,
};

export interface Preset {
  name: string;
  tag: string;
  params: Partial<SynthParams>;
}

export const PRESETS: Preset[] = [
  { name: "Volta Init", tag: "SAW / 3 VOICE", params: { ...DEFAULT_PARAMS } },
  {
    name: "Acid Filth",
    tag: "BASS / 24dB",
    params: {
      waveform: "sawtooth", octave: -1, detune: 0, unison: 1, spread: 0, sub: 0.45, glide: 0.06,
      cutoff: 420, resonance: 15, filterEnv: 0.72, keyTrack: 0.2, slope: 24,
      attack: 0.004, decay: 0.28, sustain: 0.08, release: 0.16,
      lfoRate: 0.4, lfoDepth: 0, drive: 0.62, delayMix: 0.12, delayTime: 0.24, delayFb: 0.28, reverbMix: 0.08,
    },
  },
  {
    name: "Glass Bells",
    tag: "FM-ISH / SINE",
    params: {
      waveform: "sine", octave: 1, detune: 4, unison: 2, spread: 7, sub: 0.12, glide: 0,
      cutoff: 9000, resonance: 1.2, filterEnv: 0.3, keyTrack: 0.7, slope: 12,
      attack: 0.002, decay: 1.5, sustain: 0.0, release: 1.9,
      lfoRate: 4.2, lfoDepth: 0.05, drive: 0.08, delayMix: 0.34, delayTime: 0.375, delayFb: 0.45, reverbMix: 0.52,
    },
  },
  {
    name: "Nimbus Pad",
    tag: "WIDE / SLOW",
    params: {
      waveform: "triangle", octave: 0, detune: -6, unison: 5, spread: 34, sub: 0.3, glide: 0.02,
      cutoff: 1500, resonance: 3.2, filterEnv: 0.28, keyTrack: 0.5, slope: 24,
      attack: 0.9, decay: 1.8, sustain: 0.78, release: 2.6,
      lfoRate: 0.22, lfoDepth: 0.34, drive: 0.12, delayMix: 0.3, delayTime: 0.52, delayFb: 0.5, reverbMix: 0.62,
    },
  },
  {
    name: "Neon Blade",
    tag: "LEAD / SQUARE",
    params: {
      waveform: "square", octave: 0, detune: 8, unison: 3, spread: 22, sub: 0.18, glide: 0.045,
      cutoff: 4200, resonance: 8, filterEnv: 0.34, keyTrack: 0.45, slope: 24,
      attack: 0.008, decay: 0.4, sustain: 0.62, release: 0.35,
      lfoRate: 5.4, lfoDepth: 0.1, drive: 0.45, delayMix: 0.26, delayTime: 0.28, delayFb: 0.34, reverbMix: 0.22,
    },
  },
  {
    name: "Tape Organ",
    tag: "DRAWBAR / TRI",
    params: {
      waveform: "triangle", octave: 0, detune: 0, unison: 2, spread: 5, sub: 0.55, glide: 0,
      cutoff: 5200, resonance: 0.8, filterEnv: 0.08, keyTrack: 0.8, slope: 12,
      attack: 0.006, decay: 0.12, sustain: 0.95, release: 0.14,
      lfoRate: 6.2, lfoDepth: 0.12, drive: 0.3, delayMix: 0.1, delayTime: 0.18, delayFb: 0.2, reverbMix: 0.2,
    },
  },
  {
    name: "Sub Thump",
    tag: "SUB / SINE",
    params: {
      waveform: "sine", octave: -2, detune: 0, unison: 1, spread: 0, sub: 0.7, glide: 0.08,
      cutoff: 320, resonance: 4, filterEnv: 0.35, keyTrack: 0.15, slope: 12,
      attack: 0.006, decay: 0.4, sustain: 0.35, release: 0.28,
      lfoRate: 0.3, lfoDepth: 0, drive: 0.4, delayMix: 0, delayTime: 0.3, delayFb: 0.2, reverbMix: 0.05,
    },
  },
  {
    name: "Crystal Pluck",
    tag: "PLUCK / SAW",
    params: {
      waveform: "sawtooth", octave: 1, detune: -3, unison: 3, spread: 18, sub: 0.1, glide: 0,
      cutoff: 5600, resonance: 5.5, filterEnv: 0.62, keyTrack: 0.6, slope: 24,
      attack: 0.002, decay: 0.34, sustain: 0.0, release: 0.6,
      lfoRate: 0.8, lfoDepth: 0.04, drive: 0.18, delayMix: 0.36, delayTime: 0.375, delayFb: 0.42, reverbMix: 0.44,
    },
  },
];

export const MAX_VOICES = 16;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------------ voice */

class Voice {
  midi: number;
  velocity: number;
  startedAt: number;
  releasing = false;
  releaseAt = 0;
  releaseFrom = 0;
  releaseTau = 0.1;
  endsAt = Infinity;
  dead = false;
  stopTimer: number | null = null;

  private ctx: AudioContext;
  private p: SynthParams;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];
  private pans: StereoPannerNode[] = [];
  private sub: OscillatorNode | null = null;
  private subGain: GainNode;
  private f1: BiquadFilterNode;
  private f2: BiquadFilterNode;
  private amp: GainNode;
  private lfoGain: GainNode;
  private peak: number;
  private disposed = false;
  private targetFreq: number;

  constructor(ctx: AudioContext, dest: AudioNode, lfo: OscillatorNode, p: SynthParams, midi: number, velocity: number, when: number, glideFrom: number | null) {
    this.ctx = ctx;
    this.p = { ...p };
    this.midi = midi;
    this.velocity = velocity;
    this.startedAt = when;
    this.targetFreq = midiToFreq(midi + p.octave * 12);

    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.f1 = ctx.createBiquadFilter();
    this.f2 = ctx.createBiquadFilter();
    this.f1.type = "lowpass";
    this.f2.type = "lowpass";
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.f1.frequency);
    this.lfoGain.connect(this.f2.frequency);

    this.subGain = ctx.createGain();
    this.subGain.gain.value = p.sub * 0.8;

    const n = Math.max(1, Math.round(p.unison));
    for (let i = 0; i < n; i++) {
      const osc = ctx.createOscillator();
      osc.type = p.waveform;
      const g = ctx.createGain();
      g.gain.value = 0.85 / Math.sqrt(n);
      const pan = ctx.createStereoPanner();
      pan.pan.value = n === 1 ? 0 : ((i / (n - 1)) * 2 - 1) * 0.65;
      osc.connect(g).connect(pan).connect(this.f1);
      const f = this.targetFreq;
      if (p.glide > 0.001 && glideFrom) {
        osc.frequency.setValueAtTime(glideFrom, when);
        osc.frequency.exponentialRampToValueAtTime(f, when + p.glide);
      } else {
        osc.frequency.setValueAtTime(f, when);
      }
      osc.detune.setValueAtTime(this.detuneFor(i, n, p), when);
      osc.start(when);
      this.oscs.push(osc);
      this.oscGains.push(g);
      this.pans.push(pan);
    }

    if (p.sub > 0.001) {
      const s = ctx.createOscillator();
      s.type = "sine";
      s.frequency.setValueAtTime(this.targetFreq / 2, when);
      s.connect(this.subGain).connect(this.f1);
      s.start(when);
      this.sub = s;
    }

    this.f1.connect(this.f2).connect(this.amp).connect(dest);

    // normalise polyphonic headroom a little, keep chords punchy
    this.peak = clamp(velocity, 0.05, 1) * 0.3;

    this.applyFilter(p, when, true);
    this.scheduleAttack(when);
  }

  private detuneFor(i: number, n: number, p: SynthParams) {
    const spreadPos = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    return p.detune + spreadPos * p.spread;
  }

  private filterBase(p: SynthParams) {
    const tracked = p.cutoff * Math.pow(2, (p.keyTrack * (this.midi - 60)) / 12);
    return clamp(tracked, 25, 20000);
  }

  private applyFilter(p: SynthParams, t: number, schedule: boolean) {
    const base = this.filterBase(p);
    const top = clamp(base * Math.pow(2, p.filterEnv * 4), 25, 20000);
    const sus = clamp(base * Math.pow(2, p.filterEnv * 4 * p.sustain), 25, 20000);
    const q1 = clamp(p.resonance, 0.0001, 24);
    const q2 = p.slope === 24 ? clamp(p.resonance * 0.55, 0.0001, 24) : 0.0001;
    const f2freq = p.slope === 24 ? 0 : 21000;

    this.f1.Q.setTargetAtTime(q1, t, 0.02);
    this.f2.Q.setTargetAtTime(q2, t, 0.02);
    this.lfoGain.gain.setTargetAtTime(p.lfoDepth * base * 0.55, t, 0.05);

    for (const [f, mul] of [[this.f1, 1], [this.f2, 1]] as [BiquadFilterNode, number][]) {
      const offset = f === this.f2 ? f2freq : 0;
      const param = f.frequency;
      if (schedule) {
        const a = Math.max(0.002, p.attack);
        const d = Math.max(0.01, p.decay);
        param.cancelScheduledValues(t);
        param.setValueAtTime(base + offset, t);
        param.linearRampToValueAtTime(top * mul + offset, t + a);
        param.setTargetAtTime(sus + offset, t + a, d / 3);
      } else if (!this.releasing) {
        param.setTargetAtTime(sus + offset, t, 0.035);
      }
    }
  }

  private scheduleAttack(t: number) {
    const p = this.p;
    const a = Math.max(0.002, p.attack);
    const d = Math.max(0.01, p.decay);
    const g = this.amp.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(this.peak, t + a);
    g.setTargetAtTime(this.peak * p.sustain, t + a, d / 3);
  }

  /** analytic mirror of the scheduled envelope, for the UI playhead */
  envAt(t: number): number {
    const p = this.p;
    const a = Math.max(0.002, p.attack);
    const d = Math.max(0.01, p.decay) / 3;
    if (this.releasing && t >= this.releaseAt) {
      const r = Math.max(0.012, this.releaseTau * 4) / 4;
      return this.releaseFrom * Math.exp(-(t - this.releaseAt) / r);
    }
    const dt = t - this.startedAt;
    if (dt < 0) return 0;
    if (dt < a) return dt / a;
    return p.sustain + (1 - p.sustain) * Math.exp(-(dt - a) / d);
  }

  phaseAt(t: number): "A" | "D" | "S" | "R" {
    if (this.releasing && t >= this.releaseAt) return "R";
    const dt = t - this.startedAt;
    if (dt < this.p.attack) return "A";
    if (dt < this.p.attack + this.p.decay) return "D";
    return "S";
  }

  update(next: SynthParams, patch: Partial<SynthParams>, t: number) {
    this.p = { ...this.p, ...patch };
    const p = this.p;
    if (patch.waveform) for (const o of this.oscs) o.type = patch.waveform;
    if (patch.octave !== undefined) {
      this.targetFreq = midiToFreq(this.midi + p.octave * 12);
      for (const o of this.oscs) o.frequency.setTargetAtTime(this.targetFreq, t, 0.02);
      if (this.sub) this.sub.frequency.setTargetAtTime(this.targetFreq / 2, t, 0.02);
    }
    if (patch.detune !== undefined || patch.spread !== undefined || patch.unison !== undefined) {
      const n = this.oscs.length;
      this.oscs.forEach((o, i) => o.detune.setTargetAtTime(this.detuneFor(i, n, p), t, 0.03));
    }
    if (patch.sub !== undefined) this.subGain.gain.setTargetAtTime(p.sub * 0.8, t, 0.03);
    if (
      patch.cutoff !== undefined || patch.resonance !== undefined || patch.filterEnv !== undefined ||
      patch.keyTrack !== undefined || patch.slope !== undefined || patch.lfoDepth !== undefined || patch.sustain !== undefined
    ) {
      this.applyFilter(p, t, false);
    }
    if (patch.sustain !== undefined && !this.releasing) {
      const dt = t - this.startedAt;
      if (dt > p.attack + 0.02) this.amp.gain.setTargetAtTime(this.peak * p.sustain, t, 0.05);
    }
    void next;
  }

  release(t: number, forced = false) {
    if (this.releasing) return;
    // capture the envelope level *before* switching state, otherwise the
    // release stage would always start from silence and click.
    const level = Math.max(0.0001, this.envAt(t));
    const p = this.p;
    const r = forced ? 0.03 : Math.max(0.012, p.release);
    this.releasing = true;
    this.releaseAt = t;
    this.releaseFrom = level;
    this.releaseTau = r / 4;
    const g = this.amp.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(this.releaseFrom * this.peak, t);
    g.setTargetAtTime(0, t, r / 4);

    const base = this.filterBase(p);
    for (const f of [this.f1, this.f2]) {
      const offset = f === this.f2 && p.slope !== 24 ? 21000 : 0;
      f.frequency.cancelScheduledValues(t);
      f.frequency.setValueAtTime(Math.max(25, f.frequency.value), t);
      f.frequency.setTargetAtTime(base + offset, t, r / 3);
    }
    const stopAt = t + r * 1.35 + 0.05;
    this.endsAt = stopAt;
    for (const o of this.oscs) o.stop(stopAt);
    if (this.sub) this.sub.stop(stopAt);
    this.stopTimer = window.setTimeout(() => this.dispose(), (stopAt - this.ctx.currentTime) * 1000 + 60);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.dead = true;
    if (this.stopTimer) window.clearTimeout(this.stopTimer);
    for (const o of this.oscs) {
      try { o.stop(); } catch { /* already stopped */ }
      o.disconnect();
    }
    try { this.sub?.stop(); } catch { /* noop */ }
    this.sub?.disconnect();
    this.oscGains.forEach((g) => g.disconnect());
    this.pans.forEach((p) => p.disconnect());
    this.subGain.disconnect();
    this.lfoGain.disconnect();
    this.f1.disconnect();
    this.f2.disconnect();
    this.amp.disconnect();
  }
}

/* ----------------------------------------------------------------- engine */

export interface ActiveNote {
  midi: number;
  velocity: number;
  releasing: boolean;
}

export class SynthEngine {
  ctx: AudioContext | null = null;
  params: SynthParams = { ...DEFAULT_PARAMS };
  timeBuf = new Float32Array(2048);
  freqBuf = new Float32Array(2048);
  analyserTime: AnalyserNode | null = null;
  analyserFreq: AnalyserNode | null = null;
  sampleRate = 48000;
  muted = false;

  private voices = new Map<number, Voice>();
  /** every voice that still exists, including scheduled + releasing ones (drives the UI) */
  private alive = new Set<Voice>();
  private lastFreq: number | null = null;
  private nodes: Record<string, AudioNode> = {};
  private lfo: OscillatorNode | null = null;
  private clipUntil = 0;

  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }

  get voiceCount() {
    const now = this.ctx?.currentTime ?? 0;
    let n = 0;
    this.alive.forEach((v) => { if (v.startedAt <= now && (!v.releasing || v.releaseAt > now)) n++; });
    return n;
  }

  private prune(now: number) {
    this.alive.forEach((v) => { if (v.dead || v.endsAt + 0.25 < now) this.alive.delete(v); });
  }

  async ensure(): Promise<boolean> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.sampleRate = this.ctx.sampleRate;
      this.build();
    }
    if (this.ctx.state !== "running") {
      try { await this.ctx.resume(); } catch { return false; }
    }
    return this.ctx.state === "running";
  }

  private build() {
    const ctx = this.ctx!;
    const p = this.params;

    const bus = ctx.createGain();
    bus.gain.value = 1;
    const shaper = ctx.createWaveShaper();
    shaper.oversample = "2x";
    const preFx = ctx.createGain();
    const sum = ctx.createGain();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : p.master;

    const at = ctx.createAnalyser();
    at.fftSize = 2048;
    at.smoothingTimeConstant = 0;
    const af = ctx.createAnalyser();
    af.fftSize = 4096;
    af.smoothingTimeConstant = 0.72;
    af.minDecibels = -104;
    af.maxDecibels = -4;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 2;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.09;
    const limGain = ctx.createGain();
    limGain.gain.value = p.limiter ? 1 : 0;
    const bypass = ctx.createGain();
    bypass.gain.value = p.limiter ? 0 : 1;
    const out = ctx.createGain();

    // fx: ping delay + convolution hall
    const delay = ctx.createDelay(2);
    delay.delayTime.value = p.delayTime;
    const fb = ctx.createGain();
    fb.gain.value = p.delayFb;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    const delayMix = ctx.createGain();
    delayMix.gain.value = p.delayMix;
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 2.6);
    const reverbMix = ctx.createGain();
    reverbMix.gain.value = p.reverbMix;

    bus.connect(shaper).connect(preFx);
    preFx.connect(sum);
    preFx.connect(delay);
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(delayMix).connect(sum);
    preFx.connect(conv).connect(reverbMix).connect(sum);
    sum.connect(master);
    master.connect(at);
    master.connect(af);
    master.connect(limiter).connect(limGain).connect(out);
    master.connect(bypass).connect(out);
    out.connect(ctx.destination);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = p.lfoRate;
    lfo.start();

    this.lfo = lfo;
    this.analyserTime = at;
    this.analyserFreq = af;
    this.timeBuf = new Float32Array(at.fftSize);
    this.freqBuf = new Float32Array(af.frequencyBinCount);
    this.nodes = { bus, shaper, preFx, sum, master, limiter, limGain, bypass, out, delay, fb, tone, delayMix, conv, reverbMix };
    this.setDrive(p.drive);
  }

  private setDrive(amount: number) {
    const shaper = this.nodes.shaper as WaveShaperNode | undefined;
    if (!shaper) return;
    const k = 1 + amount * 42;
    const n = 1024;
    const curve = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / norm * (0.55 + 0.45 * (1 - amount));
    }
    shaper.curve = curve;
  }

  noteOn(midi: number, velocity = 0.8, when?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.lfo) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime) + 0.001;
    const existing = this.voices.get(midi);
    if (existing) {
      existing.release(t, true);
      this.voices.delete(midi);
      // keep the fading voice alive outside the map
      window.setTimeout(() => existing.dispose(), 220);
    }
    if (this.voices.size >= MAX_VOICES) {
      const entries = Array.from(this.voices.entries()).sort((a, b) => a[1].startedAt - b[1].startedAt);
      const oldest = entries[0];
      if (oldest) {
        oldest[1].release(t, true);
        this.voices.delete(oldest[0]);
      }
    }
    const voice = new Voice(ctx, this.nodes.bus as AudioNode, this.lfo, this.params, midi, velocity, t, this.params.glide > 0.001 ? this.lastFreq : null);
    this.voices.set(midi, voice);
    this.alive.add(voice);
    this.lastFreq = midiToFreq(midi + this.params.octave * 12);
  }

  noteOff(midi: number, when?: number) {
    const ctx = this.ctx;
    const v = this.voices.get(midi);
    if (!ctx || !v) return;
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    v.release(t);
    this.voices.delete(midi);
  }

  allNotesOff(fast = true) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.voices.forEach((v) => v.release(t, fast));
    this.voices.clear();
  }

  setParams(patch: Partial<SynthParams>) {
    const prev = this.params;
    const next = { ...prev, ...patch };
    this.params = next;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = (k: string) => this.nodes[k] as GainNode | undefined;

    if (patch.master !== undefined) g("master")!.gain.setTargetAtTime(this.muted ? 0 : next.master, t, 0.02);
    if (patch.drive !== undefined) this.setDrive(next.drive);
    if (patch.delayMix !== undefined) g("delayMix")!.gain.setTargetAtTime(next.delayMix, t, 0.05);
    if (patch.reverbMix !== undefined) g("reverbMix")!.gain.setTargetAtTime(next.reverbMix, t, 0.08);
    if (patch.delayFb !== undefined) g("fb")!.gain.setTargetAtTime(next.delayFb, t, 0.05);
    if (patch.delayTime !== undefined) (this.nodes.delay as DelayNode).delayTime.setTargetAtTime(next.delayTime, t, 0.12);
    if (patch.lfoRate !== undefined && this.lfo) this.lfo.frequency.setTargetAtTime(next.lfoRate, t, 0.05);
    if (patch.limiter !== undefined) {
      g("limGain")!.gain.setTargetAtTime(next.limiter ? 1 : 0, t, 0.01);
      g("bypass")!.gain.setTargetAtTime(next.limiter ? 0 : 1, t, 0.01);
    }
    this.voices.forEach((v) => v.update(next, patch, t));
  }

  setMuted(m: boolean) {
    this.muted = m;
    const ctx = this.ctx;
    if (!ctx) return;
    (this.nodes.master as GainNode).gain.setTargetAtTime(m ? 0 : this.params.master, ctx.currentTime, 0.02);
  }

  activeNotes(): ActiveNote[] {
    const ctx = this.ctx;
    if (!ctx) return [];
    const now = ctx.currentTime;
    this.prune(now);
    const map = new Map<number, ActiveNote>();
    this.alive.forEach((v) => {
      if (v.startedAt > now) return;
      const sounding = !v.releasing || v.releaseAt > now;
      const tail = Math.min(0.4, this.params.release * 0.6 + 0.05);
      if (!sounding && now > v.releaseAt + tail) return;
      const prev = map.get(v.midi);
      if (prev && !prev.releasing) return;
      map.set(v.midi, { midi: v.midi, velocity: v.velocity, releasing: !sounding });
    });
    return Array.from(map.values()).sort((a, b) => a.midi - b.midi);
  }

  /** newest sounding voice -> envelope playhead + pitch readout */
  focus() {
    const ctx = this.ctx;
    if (!ctx) return null;
    const t = ctx.currentTime;
    const entries = Array.from(this.alive).filter((x) => x.startedAt <= t).sort((a, b) => b.startedAt - a.startedAt);
    const v = entries[0];
    if (!v) return null;
    return {
      midi: v.midi,
      value: v.envAt(t),
      phase: v.phaseAt(t),
      age: t - v.startedAt,
      relAge: v.releasing ? Math.max(0, t - v.releaseAt) : 0,
      freq: midiToFreq(v.midi + this.params.octave * 12),
    };
  }

  sampleTime() {
    if (!this.analyserTime) return null;
    this.analyserTime.getFloatTimeDomainData(this.timeBuf);
    return this.timeBuf;
  }

  sampleSpectrum() {
    if (!this.analyserFreq) return null;
    this.analyserFreq.getFloatFrequencyData(this.freqBuf);
    return this.freqBuf;
  }

  meter() {
    const buf = this.sampleTime();
    if (!buf) return { peak: 0, rms: 0, clip: false };
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const a = Math.abs(buf[i]);
      if (a > peak) peak = a;
      sum += buf[i] * buf[i];
    }
    const rms = Math.sqrt(sum / buf.length);
    if (peak >= 0.988) this.clipUntil = performance.now() + 1400;
    return { peak, rms, clip: performance.now() < this.clipUntil };
  }

  clearClip() {
    this.clipUntil = 0;
  }

  dispose() {
    this.allNotesOff(true);
    this.alive.forEach((v) => v.dispose());
    this.alive.clear();
    try { this.lfo?.stop(); } catch { /* noop */ }
    this.lfo = null;
    this.analyserFreq = null;
    this.analyserTime = null;
    this.nodes = {};
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}

function makeImpulse(ctx: AudioContext, seconds: number) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const decay = Math.pow(1 - t, 2.7);
      data[i] = (Math.random() * 2 - 1) * decay * 0.6;
    }
    // sparse early reflections for a plate-ish character
    for (let r = 0; r < 9; r++) {
      const idx = Math.floor((0.008 + r * 0.017 + Math.random() * 0.006) * rate);
      if (idx < len) data[idx] += (Math.random() * 2 - 1) * 0.5;
    }
  }
  return buf;
}