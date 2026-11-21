import { useEffect, useRef, useState, type ReactNode } from "react";
import { DEFAULT_PARAMS, MAX_VOICES, PRESETS, type Waveform } from "@/audio/engine";
import { ARP_DIVS, useSynth, type ArpPattern } from "@/audio/useSynth";
import { CHORDS, formatHz, formatTime, noteName } from "@/audio/theory";
import { EnvelopeEditor } from "@/components/EnvelopeEditor";
import { FilterCurve } from "@/components/FilterCurve";
import { Keyboard } from "@/components/Keyboard";
import { Meter } from "@/components/Meter";
import { Scope } from "@/components/Scope";
import { Fader, Knob, Led, Panel, Segmented, Stepper, Toggle } from "@/components/ui";
import { cn } from "@/utils/cn";

const AMBER = "#ff9c2b";
const CYAN = "#2ee6d6";
const LIME = "#b7f53c";
const MAGENTA = "#ff3d92";
const VIOLET = "#a78bfa";

const WAVES: { id: Waveform; label: string; path: string }[] = [
  { id: "sine", label: "Sine", path: "M1 8 Q5 0 9 8 T17 8 T25 8 T33 8" },
  { id: "triangle", label: "Tri", path: "M1 13 L9 3 L17 13 L25 3 L33 13" },
  { id: "sawtooth", label: "Saw", path: "M1 13 L9 3 L9 13 L17 3 L17 13 L25 3 L25 13 L33 3" },
  { id: "square", label: "Sqr", path: "M1 13 L1 3 L9 3 L9 13 L17 13 L17 3 L25 3 L25 13 L33 13" },
];

function Reveal({ children, className, delay = 0, id }: { children: ReactNode; className?: string; delay?: number; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.02, rootMargin: "120px 0px 120px 0px" },
    );
    io.observe(el);
    // safety net: nothing may ever stay hidden (off-screen capture, no IO, tall viewports)
    const fallback = window.setTimeout(() => setShown(true), 1100 + delay);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, [delay]);
  return (
    <div
      ref={ref}
      id={id}
      className={cn("scroll-mt-28 transition-all duration-[650ms] ease-out", shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const s = useSynth();
  const p = s.params;
  const [labels, setLabels] = useState(true);
  const [root, setRoot] = useState(60);
  const bgRef = useRef<HTMLDivElement>(null);
  const live = s.status === "live";

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (bgRef.current) bgRef.current.style.transform = `translate3d(0, ${window.scrollY * -0.05}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const preset = PRESETS[s.presetIndex];
  const activeNames = s.active.filter((n) => !n.releasing).map((n) => noteName(n.midi));
  const jump = (id: string) => document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="relative min-h-screen text-cream" onPointerDownCapture={() => { if (!live) void s.power(); }}>
      {/* ---------------------------------------------------- ambience */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          ref={bgRef}
          className="absolute inset-[-10%]"
          style={{
            background:
              "radial-gradient(1100px 620px at 10% -10%, #40200a 0%, transparent 58%)," +
              "radial-gradient(900px 560px at 94% 4%, #05323c 0%, transparent 60%)," +
              "radial-gradient(1000px 760px at 46% 116%, #330b30 0%, transparent 62%)," +
              "linear-gradient(180deg,#0a0910 0%,#08070a 60%,#0a0810 100%)",
          }}
        />
        <div className="drift absolute left-[-15%] top-[18%] h-[52vh] w-[62vw] rounded-full opacity-50 blur-[130px]" style={{ background: "radial-gradient(circle,#ff5f1f2e,transparent 70%)" }} />
        <div className="drift absolute right-[-12%] top-[46%] h-[46vh] w-[54vw] rounded-full opacity-45 blur-[130px]" style={{ background: "radial-gradient(circle,#2ee6d626,transparent 70%)", animationDelay: "-9s" }} />
        <div className="grain absolute inset-0" />
        <div className="absolute inset-0 opacity-[0.35]" style={{ background: "repeating-linear-gradient(180deg,rgba(255,255,255,0.025) 0 1px,transparent 1px 4px)" }} />
      </div>

      {/* ------------------------------------------------------ header */}
      <header className="sticky top-0 z-50 border-b border-[#2b2635] bg-[#0a0910]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-9 w-9 place-items-center rounded-[9px] border border-amber/50 bg-[#1a1208]" style={{ boxShadow: "0 0 22px -6px #ff9c2b, inset 0 1px 0 #ffffff22" }}>
              <svg viewBox="0 0 34 16" className="h-4 w-6">
                <path d="M1 8 Q5 0 9 8 T17 8 T25 8 T33 8" fill="none" stroke={AMBER} strokeWidth="2" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 4px #ff9c2b)" }} />
              </svg>
            </div>
            <div className="leading-none">
              <h1 className="text-[19px] font-bold tracking-[0.14em] text-cream" style={{ textShadow: "0 0 22px #ff9c2b55" }}>
                VOLTA<span className="text-amber">·</span>24
              </h1>
              <p className="silk mt-1 hidden sm:block">Polyphonic synth · scope</p>
            </div>
          </div>

          <div className="order-3 flex w-full items-center gap-1.5 sm:order-none sm:w-auto">
            <button type="button" className="btn h-8 w-7" aria-label="Previous preset" onClick={() => s.loadPreset((s.presetIndex - 1 + PRESETS.length) % PRESETS.length)}>◀</button>
            <div className="panel-inset relative flex h-8 min-w-0 flex-1 items-center gap-2 pl-2.5 pr-7 sm:w-[228px]">
              <Led on color={s.edited ? AMBER : LIME} size={6} />
              <select
                aria-label="Preset"
                value={s.presetIndex}
                onChange={(e) => s.loadPreset(Number(e.target.value))}
                className="readout w-full appearance-none truncate bg-transparent text-[11px] font-bold text-cream outline-none"
              >
                {PRESETS.map((presetItem, i) => (
                  <option key={presetItem.name} value={i} className="bg-[#15131b] text-cream">
                    {String(i + 1).padStart(2, "0")} · {presetItem.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 text-[8px] text-dim">▼</span>
            </div>
            <button type="button" className="btn h-8 w-7" aria-label="Next preset" onClick={() => s.loadPreset((s.presetIndex + 1) % PRESETS.length)}>▶</button>
            <span className="silk hidden shrink-0 md:inline">{s.edited ? "Edited" : preset.tag}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Toggle label={s.demoOn ? `Demo ${s.demoChord}` : "Demo"} on={s.demoOn} onChange={s.toggleDemo} color={MAGENTA} className="h-8" />
            <button
              type="button"
              onClick={() => void s.power()}
              className="btn flex h-8 items-center gap-1.5 px-2.5"
              style={live ? { borderColor: "#b7f53c66", color: LIME } : { borderColor: "#ff9c2b88", color: AMBER }}
              title="Audio engine state"
            >
              <Led on={live} color={live ? LIME : AMBER} size={6} pulse={!live} />
              {live ? "Live" : "Standby"}
            </button>
            <Toggle label={s.muted ? "Muted" : "Sound"} on={!s.muted} onChange={s.toggleMute} color={LIME} className="h-8" />
            <button type="button" onClick={s.panic} className="btn h-8 border-danger/50 px-2.5 text-danger hover:border-danger hover:text-[#ff8090]" title="All notes off (Esc)">Panic</button>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------- body */}
      <main className="mx-auto max-w-[1500px] px-2 pb-14 pt-4 sm:px-5">
        <div className="relative overflow-hidden rounded-[20px] border border-[#2b2635] bg-[#0d0c12]/72 p-2 shadow-[0_50px_90px_-50px_#000] sm:p-3 xl:px-6">
          <div className="wood absolute inset-y-0 left-0 hidden w-4 xl:block" />
          <div className="wood absolute inset-y-0 right-0 hidden w-4 xl:block" />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            {/* ------------------------------------------------ scope */}
            <Reveal id="stage-scope" className="lg:col-span-8">
              <Scope engine={s.engine} notes={s.active} live={live} onPower={() => void s.power()} octaveShift={p.octave} />
            </Reveal>

            {/* ----------------------------------------------- master */}
            <Reveal id="stage-master" className="lg:col-span-4" delay={80}>
              <Panel index="02" title="Master" accent={AMBER} className="h-full" right={<span className="readout text-[9px] text-dim">{MAX_VOICES} VOICE POLY</span>}>
                <div className="flex gap-3">
                  <Fader label="Level" value={p.master} onChange={(v) => s.setParam("master", v)} color={AMBER} />
                  <div className="flex flex-1 flex-col justify-between gap-2">
                    <div className="flex items-start justify-around gap-1">
                      <Knob label="Drive" value={p.drive} min={0} max={1} defaultValue={DEFAULT_PARAMS.drive} color="#ff5f1f" onChange={(v) => s.setParam("drive", v)} format={(v) => `${Math.round(v * 100)}%`} hint="Waveshaper saturation before the filter stage" />
                      <Knob label="Width" value={p.spread} min={0} max={60} defaultValue={DEFAULT_PARAMS.spread} color={VIOLET} onChange={(v) => s.setParam("spread", v)} format={(v) => `${Math.round(v)}¢`} hint="Unison detune spread / stereo width" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Toggle label="Limiter" on={p.limiter} onChange={(v) => s.setParam("limiter", v)} color={CYAN} hint="Safety limiter after the meter — bypass it to hear raw clipping" />
                      <div className="panel-inset flex items-center gap-1 px-2 py-1.5">
                        <span className="silk">Voices</span>
                        <span className="readout text-[11px] font-bold text-amber">{String(s.active.length).padStart(2, "0")}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-[3px]">
                      {Array.from({ length: MAX_VOICES }).map((_, i) => (
                        <Led key={i} on={i < s.active.length} color={i > 11 ? MAGENTA : i > 7 ? AMBER : LIME} size={6} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Meter engine={s.engine} live={live} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#2e2939] pt-2">
                  <span className="silk">Now</span>
                  <span className="readout truncate text-[11px] font-bold text-cream">{preset.name}{s.edited && <span className="text-amber"> *</span>}</span>
                  <span className="readout text-[10px] text-cyan">{s.focusFreq ? `${formatHz(s.focusFreq)} Hz` : "— Hz"}</span>
                </div>
                <div className="mt-2.5">
                  <SignalChain p={p} active={s.active.length > 0} onJump={jump} />
                </div>
              </Panel>
            </Reveal>

            {/* -------------------------------------------------- osc */}
            <Reveal id="stage-osc" className="lg:col-span-4" delay={40}>
              <Panel index="03" title="Oscillator bank" accent={AMBER} className="h-full" right={<span className="readout text-[9px] text-dim">{p.unison}× UNISON</span>}>
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  {WAVES.map((w) => {
                    const on = p.waveform === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => s.setParam("waveform", w.id)}
                        className={cn("panel-inset flex flex-col items-center gap-1 py-2 transition-all duration-150", on ? "border-amber/70" : "hover:border-[#4b4455]")}
                        style={on ? { background: "linear-gradient(180deg,#ff9c2b26,#ff9c2b0a)", boxShadow: "inset 0 0 18px -6px #ff9c2b, 0 0 18px -8px #ff9c2b" } : undefined}
                      >
                        <svg viewBox="0 0 34 16" className="h-4 w-8">
                          <path d={w.path} fill="none" stroke={on ? AMBER : "#8d8499"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={on ? { filter: "drop-shadow(0 0 4px #ff9c2b)" } : undefined} />
                        </svg>
                        <span className={cn("readout text-[9px] font-bold uppercase", on ? "text-amber" : "text-dim")}>{w.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <Knob label="Detune" value={p.detune} min={-100} max={100} defaultValue={0} bipolar color={AMBER} onChange={(v) => s.setParam("detune", v)} format={(v) => `${v > 0 ? "+" : ""}${Math.round(v)}¢`} />
                  <Knob label="Spread" value={p.spread} min={0} max={60} defaultValue={DEFAULT_PARAMS.spread} color={VIOLET} onChange={(v) => s.setParam("spread", v)} format={(v) => `${Math.round(v)}¢`} />
                  <Knob label="Sub" value={p.sub} min={0} max={1} defaultValue={DEFAULT_PARAMS.sub} color={MAGENTA} onChange={(v) => s.setParam("sub", v)} format={(v) => `${Math.round(v * 100)}%`} hint="Sine sub oscillator one octave down" />
                  <Knob label="Glide" value={p.glide} min={0} max={0.4} defaultValue={0} color={CYAN} onChange={(v) => s.setParam("glide", v)} format={(v) => (v < 0.002 ? "OFF" : formatTime(v))} hint="Portamento from the previously played pitch" />
                </div>
                <div className="mt-3 flex items-end justify-between gap-2 border-t border-[#2e2939] pt-3">
                  <Stepper label="Octave" value={p.octave} min={-2} max={2} onChange={(v) => s.setParam("octave", v)} color={AMBER} />
                  <Stepper label="Unison" value={p.unison} min={1} max={5} onChange={(v) => s.setParam("unison", v)} color={VIOLET} />
                  <div className="panel-inset flex-1 px-2 py-1.5">
                    <div className="silk mb-1">Engine</div>
                    <div className="readout text-[9px] leading-relaxed text-dim">
                      {p.unison} osc + sub → LPF → ADSR<br />
                      <span className="text-cyan">{p.unison * 2 + 1}</span> nodes / voice
                    </div>
                  </div>
                </div>
              </Panel>
            </Reveal>

            {/* ----------------------------------------------- filter */}
            <Reveal id="stage-filter" className="lg:col-span-4" delay={100}>
              <Panel
                index="04" title="Low-pass filter" accent={CYAN} className="h-full"
                right={<Segmented size="sm" className="w-[104px]" value={p.slope} onChange={(v) => s.setParam("slope", v)} options={[{ value: 12 as const, label: "12dB" }, { value: 24 as const, label: "24dB" }]} />}
              >
                <FilterCurve
                  cutoff={p.cutoff}
                  resonance={p.resonance}
                  slope={p.slope}
                  sampleRate={s.engine.sampleRate}
                  onChange={(patch) => {
                    if (patch.cutoff !== undefined) s.setParam("cutoff", patch.cutoff);
                    if (patch.resonance !== undefined) s.setParam("resonance", patch.resonance);
                  }}
                />
                <div className="mt-3 grid grid-cols-4 gap-1">
                  <Knob label="Cutoff" value={p.cutoff} min={30} max={16000} curve="log" defaultValue={DEFAULT_PARAMS.cutoff} color={CYAN} onChange={(v) => s.setParam("cutoff", v)} format={(v) => formatHz(v)} />
                  <Knob label="Reso" value={p.resonance} min={0.3} max={18} defaultValue={DEFAULT_PARAMS.resonance} color={MAGENTA} onChange={(v) => s.setParam("resonance", v)} format={(v) => v.toFixed(1)} />
                  <Knob label="Env amt" value={p.filterEnv} min={-1} max={1} bipolar defaultValue={DEFAULT_PARAMS.filterEnv} color={LIME} onChange={(v) => s.setParam("filterEnv", v)} format={(v) => `${v > 0 ? "+" : ""}${(v * 4).toFixed(1)}oct`} hint="Envelope modulation of the cutoff, ±4 octaves" />
                  <Knob label="Key trk" value={p.keyTrack} min={0} max={1} defaultValue={DEFAULT_PARAMS.keyTrack} color={AMBER} onChange={(v) => s.setParam("keyTrack", v)} format={(v) => `${Math.round(v * 100)}%`} hint="Cutoff follows the played note" />
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-[#2e2939] pt-2.5">
                  <Led on={s.active.length > 0} color={CYAN} size={6} />
                  <span className="readout text-[9px] leading-relaxed text-dim">
                    BIQUAD LPF · {p.slope} dB/OCT · Q {p.resonance.toFixed(1)} · ENV {(p.filterEnv * 4).toFixed(1)} OCT
                  </span>
                </div>
              </Panel>
            </Reveal>

            {/* -------------------------------------------------- env */}
            <Reveal id="stage-env" className="lg:col-span-4" delay={160}>
              <Panel index="05" title="ADSR envelope" accent={LIME} className="h-full" right={<span className="readout text-[9px] text-dim">DRAG NODES</span>}>
                <EnvelopeEditor params={p} onChange={s.setParam} engine={s.engine} />
                <p className="silk mt-2.5 leading-relaxed">
                  <span className="text-cyan">– – –</span> filter envelope ghost · playhead follows the newest voice
                </p>
              </Panel>
            </Reveal>

            {/* -------------------------------------------- mod / fx */}
            <Reveal id="stage-fx" className="lg:col-span-5" delay={40}>
              <Panel index="06" title="Modulation & space" accent={VIOLET} className="h-full">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="silk text-violet">LFO → cutoff</span>
                      <div className="panel-inset relative h-2 flex-1 overflow-hidden">
                        <span
                          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-violet shadow-[0_0_8px_#a78bfa]"
                          style={{ animation: `lfoSweep ${Math.max(0.08, 1 / p.lfoRate).toFixed(2)}s ease-in-out infinite alternate`, left: 0 }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <Knob label="Rate" value={p.lfoRate} min={0.05} max={14} curve="log" defaultValue={DEFAULT_PARAMS.lfoRate} color={VIOLET} onChange={(v) => s.setParam("lfoRate", v)} format={(v) => `${v.toFixed(2)}Hz`} />
                      <Knob label="Depth" value={p.lfoDepth} min={0} max={1} defaultValue={DEFAULT_PARAMS.lfoDepth} color={VIOLET} onChange={(v) => s.setParam("lfoDepth", v)} format={(v) => `${Math.round(v * 100)}%`} />
                    </div>
                  </div>
                  <div className="hidden w-px bg-[#2e2939] sm:block" />
                  <div className="flex-[1.9]">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="silk text-magenta">Delay · plate reverb</span>
                      <div className="h-px flex-1 bg-gradient-to-r from-magenta/50 to-transparent" />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <Knob label="Time" value={p.delayTime} min={0.04} max={0.9} curve="log" defaultValue={DEFAULT_PARAMS.delayTime} color={MAGENTA} onChange={(v) => s.setParam("delayTime", v)} format={(v) => `${Math.round(v * 1000)}ms`} />
                      <Knob label="Fdbk" value={p.delayFb} min={0} max={0.85} defaultValue={DEFAULT_PARAMS.delayFb} color={MAGENTA} onChange={(v) => s.setParam("delayFb", v)} format={(v) => `${Math.round(v * 100)}%`} />
                      <Knob label="Delay" value={p.delayMix} min={0} max={0.8} defaultValue={DEFAULT_PARAMS.delayMix} color={MAGENTA} onChange={(v) => s.setParam("delayMix", v)} format={(v) => `${Math.round(v * 100)}%`} />
                      <Knob label="Reverb" value={p.reverbMix} min={0} max={0.8} defaultValue={DEFAULT_PARAMS.reverbMix} color={CYAN} onChange={(v) => s.setParam("reverbMix", v)} format={(v) => `${Math.round(v * 100)}%`} />
                    </div>
                  </div>
                </div>
              </Panel>
            </Reveal>

            {/* ------------------------------------------ performance */}
            <Reveal id="stage-chords" className="lg:col-span-7" delay={100}>
              <Panel
                index="07" title="Chords & arpeggiator" accent={MAGENTA} className="h-full"
                right={<span className="readout text-[9px] text-dim">{s.pool.length} HELD</span>}
              >
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="flex-[1.35]">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="silk">Chord pads</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <Stepper label="" value={root} min={48} max={72} onChange={setRoot} color={MAGENTA} />
                        <span className="readout w-8 text-[11px] font-bold text-magenta">{noteName(root)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                      {CHORDS.map((c) => {
                        const on = s.chordId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); s.playChord(c.id, root); }}
                            onPointerUp={() => s.stopChord(root)}
                            onPointerLeave={() => s.stopChord(root)}
                            onPointerCancel={() => s.stopChord(root)}
                            className={cn("panel-inset flex h-[46px] flex-col items-center justify-center gap-0.5 transition-all duration-100 active:translate-y-px", on ? "border-magenta/70" : "hover:border-[#4b4455]")}
                            style={on ? { background: "linear-gradient(180deg,#ff3d9226,#ff3d920a)", boxShadow: "inset 0 0 18px -8px #ff3d92, 0 0 18px -10px #ff3d92" } : undefined}
                          >
                            <span className={cn("readout text-[10px] font-bold", on ? "text-magenta" : "text-cream")}>{c.label}</span>
                            <span className="readout text-[8px] text-dim">{noteName(root).replace(/-?\d+$/, "")}{c.suffix}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Toggle label="Chord keys" on={s.chordMode} onChange={s.setChordMode} color={MAGENTA} hint="Every key triggers the selected chord shape" />
                      <Toggle label="Hold" on={s.hold} onChange={s.toggleHold} color={AMBER} hint="Latch notes (Space)" />
                      <Toggle label="Caps" on={labels} onChange={setLabels} color={CYAN} hint="Show QWERTY caps on the keys" />
                    </div>
                  </div>

                  <div className="hidden w-px bg-[#2e2939] md:block" />

                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Toggle label="Arp" on={s.arpOn} onChange={s.setArpOn} color={LIME} />
                      <div className="h-px flex-1 bg-gradient-to-r from-lime/40 to-transparent" />
                      <span className="readout text-[9px] text-dim">104 BPM</span>
                    </div>
                    <span className="silk mb-1 block">Rate</span>
                    <Segmented
                      color={LIME}
                      size="sm"
                      value={s.arpDiv}
                      onChange={s.setArpDiv}
                      options={ARP_DIVS.map((d) => ({ value: d.id, label: d.id }))}
                    />
                    <span className="silk mb-1 mt-2.5 block">Pattern</span>
                    <Segmented
                      color={CYAN}
                      size="sm"
                      value={s.arpPattern}
                      onChange={(v) => s.setArpPattern(v as ArpPattern)}
                      options={[
                        { value: "up", label: "Up" },
                        { value: "down", label: "Dn" },
                        { value: "updown", label: "Up/Dn" },
                        { value: "random", label: "Rnd" },
                        { value: "chord", label: "All" },
                      ]}
                    />
                    <p className="readout mt-2.5 text-[9px] leading-relaxed text-dim">
                      {s.arpOn
                        ? s.pool.length ? `Arming ${s.pool.map((n) => noteName(n)).join(" ")}` : "Hold notes or press DEMO to feed the arp"
                        : "Polyphonic direct mode — up to 16 simultaneous voices"}
                    </p>
                  </div>
                </div>
              </Panel>
            </Reveal>

            {/* --------------------------------------------- keyboard */}
            <Reveal id="stage-keys" className="lg:col-span-12" delay={60}>
              <Panel
                index="08" title="Keyboard" accent={AMBER}
                right={
                  <div className="flex items-center gap-2">
                    <span className="readout hidden text-[9px] text-dim sm:inline">{noteName(s.baseOctave * 12 + 12)} – {noteName(s.baseOctave * 12 + 36)}</span>
                    <Led on={s.active.length > 0} color={AMBER} size={6} />
                  </div>
                }
              >
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <Stepper label="Octave" value={s.baseOctave} min={1} max={7} onChange={s.setBaseOctave} color={AMBER} />
                  <div className="panel-inset flex min-w-[132px] items-center gap-2 px-2.5 py-2">
                    <span className="silk">Playing</span>
                    <span className="readout truncate text-[11px] font-bold text-amber">{activeNames.length ? activeNames.join(" ") : "—"}</span>
                  </div>
                  <div className="panel-inset hidden items-center gap-2 px-2.5 py-2 sm:flex">
                    <span className="silk">Shape</span>
                    <span className="readout text-[11px] font-bold text-magenta">
                      {s.chordMode ? `${noteName(root).replace(/-?\d+$/, "")}${CHORDS.find((c) => c.id === s.chordId)?.suffix ?? ""}` : "MONO KEY"}
                    </span>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Toggle label="Hold" on={s.hold} onChange={s.toggleHold} color={AMBER} />
                    <Toggle label="Chord" on={s.chordMode} onChange={s.setChordMode} color={MAGENTA} />
                    <Toggle label="Caps" on={labels} onChange={setLabels} color={CYAN} />
                  </div>
                </div>
                <Keyboard
                  baseOctave={s.baseOctave}
                  notes={s.active}
                  pool={s.pool}
                  labels={labels}
                  onNoteOn={s.noteOn}
                  onNoteOff={s.noteOff}
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Hint k="Z – M" v="lower octave" />
                  <Hint k="Q – I" v="upper octave" />
                  <Hint k="Shift" v="sustain pedal" />
                  <Hint k="Space" v="hold / latch" />
                  <Hint k="← →" v="octave" />
                  <Hint k="Esc" v="panic" />
                  <span className="readout ml-auto text-[9px] text-dim">Click lower on a key for higher velocity · drag across keys to glissando</span>
                </div>
              </Panel>
            </Reveal>
          </div>
        </div>

        <footer className="mx-auto mt-5 flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-2">
          <span className="silk">Volta·24 — built on the Web Audio API</span>
          <span className="readout text-[9px] text-dim">
            {s.engine.sampleRate / 1000} kHz · {MAX_VOICES} voices · {p.unison}× unison + sub · biquad LPF {p.slope} dB · FFT 4096 · convolution plate
          </span>
          <span className="readout ml-auto text-[9px] text-dim">{s.status === "error" ? "Web Audio unavailable in this browser" : live ? "engine running" : "press any key to start the engine"}</span>
        </footer>
      </main>
    </div>
  );
}

function SignalChain({ p, active, onJump }: { p: typeof DEFAULT_PARAMS; active: boolean; onJump: (id: string) => void }) {
  const nodes = [
    { id: "osc", label: "OSC", sub: `${p.unison}× ${p.waveform.slice(0, 3).toUpperCase()}`, color: AMBER },
    { id: "filter", label: "LPF", sub: `${formatHz(p.cutoff)}Hz`, color: CYAN },
    { id: "env", label: "ADSR", sub: formatTime(p.release), color: LIME },
    { id: "master", label: "DRIVE", sub: `${Math.round(p.drive * 100)}%`, color: "#ff5f1f" },
    { id: "fx", label: "FX", sub: `${Math.round(((p.delayMix + p.reverbMix) / 1.6) * 100)}%`, color: MAGENTA },
    { id: "master", label: "OUT", sub: p.limiter ? "LIMIT" : "RAW", color: p.limiter ? LIME : "#ff2f45" },
  ];
  return (
    <div className="panel-inset px-2 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="silk">Signal path</span>
        <div className="h-px flex-1 bg-gradient-to-r from-[#3a3444] to-transparent" />
        <span className="readout text-[8px] text-dim">TAP A STAGE</span>
      </div>
      <div className="flex items-stretch">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex min-w-0 flex-1 items-center">
            <button
              type="button"
              onClick={() => onJump(n.id)}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded px-0.5 py-1 transition-colors hover:bg-white/5"
              title={`Jump to ${n.label}`}
            >
              <Led on={active} color={n.color} size={5} />
              <span className="readout text-[9px] font-bold leading-none" style={{ color: n.color }}>{n.label}</span>
              <span className="readout w-full truncate text-center text-[7.5px] leading-none text-dim">{n.sub}</span>
            </button>
            {i < nodes.length - 1 && (
              <div className="relative mx-0.5 h-px w-3 shrink-0 bg-[#3a3444] sm:w-4">
                {active && (
                  <span
                    className="absolute top-1/2 h-[3px] w-[3px] -translate-y-1/2 rounded-full"
                    style={{ background: n.color, boxShadow: `0 0 6px ${n.color}`, animation: `flow 1.1s linear ${i * 0.12}s infinite` }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Hint({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="readout rounded border border-[#443d51] bg-[#1a1723] px-1.5 py-0.5 text-[9px] font-bold text-cream">{k}</kbd>
      <span className="silk">{v}</span>
    </span>
  );
}