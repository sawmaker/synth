import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PARAMS, PRESETS, SynthEngine, type ActiveNote, type SynthParams } from "./engine";
import { CHORDS, KEY_MAP, chordNotes, midiToFreq } from "./theory";

export type ArpPattern = "up" | "down" | "updown" | "random" | "chord";
export const ARP_DIVS = [
  { id: "1/4", beats: 1 },
  { id: "1/8", beats: 0.5 },
  { id: "1/8T", beats: 1 / 3 },
  { id: "1/16", beats: 0.25 },
  { id: "1/32", beats: 0.125 },
];

const DEMO_PROGRESSION = [
  { name: "Am7", notes: [69, 72, 76, 79] },
  { name: "Fmaj7", notes: [65, 69, 72, 76] },
  { name: "Cmaj9", notes: [60, 64, 67, 71, 74] },
  { name: "G6", notes: [67, 71, 74, 76] },
];

const BPM = 104;
const BEAT = 60 / BPM;

export function useSynth() {
  const engineRef = useRef<SynthEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SynthEngine();
  const engine = engineRef.current;

  const [params, setParamsState] = useState<SynthParams>({ ...DEFAULT_PARAMS });
  const [status, setStatus] = useState<"standby" | "live" | "error">("standby");
  const [muted, setMutedState] = useState(false);
  const [active, setActive] = useState<ActiveNote[]>([]);
  const [presetIndex, setPresetIndex] = useState(0);
  const [edited, setEdited] = useState(false);
  const [baseOctave, setBaseOctave] = useState(4);
  const [chordMode, setChordMode] = useState(false);
  const [chordId, setChordId] = useState("min7");
  const [hold, setHold] = useState(false);
  const [arpOn, setArpOn] = useState(false);
  const [arpDiv, setArpDiv] = useState("1/8");
  const [arpPattern, setArpPattern] = useState<ArpPattern>("updown");
  const [demoOn, setDemoOn] = useState(false);
  const [demoChord, setDemoChord] = useState("");
  const [pool, setPool] = useState<number[]>([]);

  // ---- live control mirror (avoids stale closures in audio callbacks) ----
  const ctl = useRef({
    baseOctave, chordMode, chordId, hold, arpOn, arpDiv, arpPattern, demoOn,
    pedal: false,
  });
  ctl.current.baseOctave = baseOctave;
  ctl.current.chordMode = chordMode;
  ctl.current.chordId = chordId;
  ctl.current.hold = hold;
  ctl.current.arpOn = arpOn;
  ctl.current.arpDiv = arpDiv;
  ctl.current.arpPattern = arpPattern;
  ctl.current.demoOn = demoOn;

  const gates = useRef(new Map<number, number>());
  const physical = useRef(new Set<number>());
  const latched = useRef(new Set<number>());
  const triggers = useRef(new Map<number, number[]>());
  const arpState = useRef({ step: 0, dir: 1, next: 0, pool: [] as number[], sounding: [] as number[] });
  const demoState = useRef({ index: 0, next: 0 });

  const power = useCallback(async () => {
    const ok = await engine.ensure();
    setStatus(ok ? "live" : engine.ctx ? "standby" : "error");
    return ok;
  }, [engine]);

  const syncPool = useCallback(() => {
    const set = new Set<number>([...physical.current, ...latched.current]);
    const arr = Array.from(set).sort((a, b) => a - b);
    arpState.current.pool = arr;
    setPool(arr);
  }, []);

  const stopNote = useCallback((midi: number) => {
    engine.noteOff(midi);
  }, [engine]);


  const startVoices = useCallback((notes: number[], velocity: number) => {
    if (ctl.current.arpOn) return; // arpeggiator owns the gate
    notes.forEach((n) => engine.noteOn(n, velocity));
  }, [engine]);

  const pressNotes = useCallback((trigger: number, notes: number[], velocity: number) => {
    void power();
    if (ctl.current.hold && !ctl.current.arpOn) {
      // latch mode: pressing a sounding note again releases it
      const allLatched = notes.every((n) => latched.current.has(n));
      if (allLatched) {
        notes.forEach((n) => { latched.current.delete(n); stopNote(n); });
        triggers.current.delete(trigger);
        syncPool();
        return;
      }
    }
    triggers.current.set(trigger, notes);
    notes.forEach((n) => {
      physical.current.add(n);
      latched.current.delete(n);
      gates.current.set(n, (gates.current.get(n) ?? 0) + 1);
    });
    startVoices(notes, velocity);
    syncPool();
  }, [power, startVoices, stopNote, syncPool]);

  const releaseNotes = useCallback((trigger: number) => {
    const notes = triggers.current.get(trigger);
    if (!notes) return;
    triggers.current.delete(trigger);
    notes.forEach((n) => {
      const left = (gates.current.get(n) ?? 1) - 1;
      if (left > 0) { gates.current.set(n, left); return; }
      gates.current.delete(n);
      physical.current.delete(n);
      if (ctl.current.hold || ctl.current.pedal) latched.current.add(n);
      else stopNote(n);
    });
    syncPool();
  }, [stopNote, syncPool]);

  const panic = useCallback(() => {
    engine.allNotesOff(true);
    gates.current.clear();
    physical.current.clear();
    latched.current.clear();
    triggers.current.clear();
    arpState.current.sounding = [];
    arpState.current.step = 0;
    setDemoOn(false);
    setDemoChord("");
    syncPool();
  }, [engine, syncPool]);

  const setParam = useCallback(<K extends keyof SynthParams>(key: K, value: SynthParams[K]) => {
    setParamsState((prev) => {
      const next = { ...prev, [key]: value };
      engine.setParams({ [key]: value } as Partial<SynthParams>);
      return next;
    });
    setEdited(true);
  }, [engine]);

  const loadPreset = useCallback((index: number) => {
    const preset = PRESETS[index];
    if (!preset) return;
    const next = { ...DEFAULT_PARAMS, ...preset.params };
    setParamsState(next);
    engine.setParams(next);
    setPresetIndex(index);
    setEdited(false);
  }, [engine]);

  const toggleMute = useCallback(() => {
    setMutedState((m) => { engine.setMuted(!m); return !m; });
  }, [engine]);

  const toggleHold = useCallback(() => {
    setHold((h) => {
      const next = !h;
      if (!next) {
        const keep = new Set(physical.current);
        latched.current.forEach((n) => { if (!keep.has(n)) stopNote(n); });
        latched.current.clear();
        syncPool();
      }
      return next;
    });
  }, [stopNote, syncPool]);

  const noteOn = useCallback((midi: number, velocity = 0.8) => {
    const shape = CHORDS.find((c) => c.id === ctl.current.chordId) ?? CHORDS[0];
    const notes = ctl.current.chordMode ? chordNotes(midi, shape.intervals).filter((n) => n <= 108) : [midi];
    pressNotes(midi, notes, velocity);
  }, [pressNotes]);

  const noteOff = useCallback((midi: number) => releaseNotes(midi), [releaseNotes]);

  const playChord = useCallback((id: string, root: number) => {
    setChordId(id);
    const shape = CHORDS.find((c) => c.id === id) ?? CHORDS[0];
    pressNotes(-1000 - root, chordNotes(root, shape.intervals), 0.78);
  }, [pressNotes]);

  const stopChord = useCallback((root: number) => releaseNotes(-1000 - root), [releaseNotes]);

  const toggleDemo = useCallback(() => {
    void power();
    setDemoOn((d) => {
      const next = !d;
      if (next) {
        setArpOn(true);
        demoState.current = { index: -1, next: 0 };
      } else {
        engine.allNotesOff(false);
        latched.current.clear();
        physical.current.clear();
        triggers.current.clear();
        setDemoChord("");
        syncPool();
      }
      return next;
    });
  }, [engine, power, syncPool]);

  // ------------------------------------------------------ scheduler loop
  useEffect(() => {
    const id = window.setInterval(() => {
      const ctx = engine.ctx;
      if (!ctx || ctx.state !== "running") return;
      const now = ctx.currentTime;
      const c = ctl.current;

      // demo progression feeds the arpeggiator pool
      if (c.demoOn && now >= demoState.current.next) {
        const idx = (demoState.current.index + 1) % DEMO_PROGRESSION.length;
        demoState.current = { index: idx, next: now + BEAT * 8 };
        const chord = DEMO_PROGRESSION[idx];
        latched.current = new Set(chord.notes);
        physical.current.clear();
        arpState.current.pool = [...chord.notes];
        setPool([...chord.notes]);
        setDemoChord(chord.name);
      }

      if (!c.arpOn) return;
      const st = arpState.current;
      const div = ARP_DIVS.find((d) => d.id === c.arpDiv) ?? ARP_DIVS[1];
      const stepDur = BEAT * div.beats;
      if (st.next < now) st.next = now + 0.03;

      while (st.next < now + 0.14) {
        const notes = st.pool;
        if (notes.length === 0) { st.next = now + 0.08; break; }
        const when = st.next;
        const gate = Math.max(0.045, stepDur * 0.62);
        let played: number[] = [];
        if (c.arpPattern === "chord") {
          played = [...notes];
        } else if (c.arpPattern === "random") {
          played = [notes[Math.floor(Math.random() * notes.length)]];
        } else {
          if (st.step >= notes.length) st.step = 0;
          let idx = st.step;
          if (c.arpPattern === "down") idx = notes.length - 1 - st.step;
          if (c.arpPattern === "updown" && notes.length > 1) {
            const period = notes.length * 2 - 2;
            const pos = st.step % period;
            idx = pos < notes.length ? pos : period - pos;
          }
          played = [notes[Math.max(0, Math.min(notes.length - 1, idx))]];
          st.step = (st.step + 1) % Math.max(1, notes.length * 2);
        }
        played.forEach((n, i) => {
          engine.noteOn(n, i === 0 ? 0.82 : 0.62, when);
          engine.noteOff(n, when + gate);
        });
        st.next += stepDur;
      }
    }, 25);
    return () => window.clearInterval(id);
  }, [engine]);

  // ------------------------------------------------ active note polling
  useEffect(() => {
    let sig = "";
    const id = window.setInterval(() => {
      const list = engine.activeNotes();
      const next = list.map((n) => `${n.midi}${n.releasing ? "r" : ""}`).join(",");
      if (next !== sig) { sig = next; setActive(list); }
    }, 32);
    return () => window.clearInterval(id);
  }, [engine]);

  // -------------------------------------------------- computer keyboard
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el || !el.tagName) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
    };
    const down = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.code === "Escape") { panic(); return; }
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) toggleHold(); return; }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") { ctl.current.pedal = true; return; }
      if (e.code === "ArrowLeft") { e.preventDefault(); setBaseOctave((o) => Math.max(1, o - 1)); return; }
      if (e.code === "ArrowRight") { e.preventDefault(); setBaseOctave((o) => Math.min(7, o + 1)); return; }
      const offset = KEY_MAP[e.code];
      if (offset === undefined) return;
      e.preventDefault();
      if (e.repeat || down.has(e.code)) return;
      down.add(e.code);
      noteOn(ctl.current.baseOctave * 12 + 12 + offset, 0.82);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        ctl.current.pedal = false;
        const keep = new Set(physical.current);
        latched.current.forEach((n) => { if (!keep.has(n) && !ctl.current.hold) stopNote(n); });
        if (!ctl.current.hold) latched.current.clear();
        syncPool();
        return;
      }
      const offset = KEY_MAP[e.code];
      if (offset === undefined) return;
      down.delete(e.code);
      noteOff(ctl.current.baseOctave * 12 + 12 + offset);
    };
    const onBlur = () => {
      down.clear();
      ctl.current.pedal = false;
      Array.from(triggers.current.keys()).forEach((k) => releaseNotes(k));
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [noteOn, noteOff, panic, releaseNotes, stopNote, syncPool, toggleHold]);

  // when the arp switches on, silence sustained direct notes; off -> retrigger held pool
  useEffect(() => {
    engine.allNotesOff(true);
    arpState.current.step = 0;
    arpState.current.next = 0;
    if (!arpOn && !ctl.current.demoOn) {
      const notes = Array.from(new Set([...physical.current, ...latched.current]));
      notes.forEach((n) => engine.noteOn(n, 0.75));
    }
  }, [arpOn, engine]);

  useEffect(() => () => engine.dispose(), [engine]);

  const focusMidi = active.length ? active[active.length - 1].midi : null;

  return {
    engine, params, setParam, status, power, muted, toggleMute,
    active, pool, presetIndex, loadPreset, edited,
    baseOctave, setBaseOctave, chordMode, setChordMode, chordId, setChordId,
    hold, toggleHold, arpOn, setArpOn, arpDiv, setArpDiv, arpPattern, setArpPattern,
    demoOn, toggleDemo, demoChord, noteOn, noteOff, playChord, stopChord, panic,
    focusFreq: focusMidi === null ? null : midiToFreq(focusMidi + params.octave * 12),
  };
}

export type SynthApi = ReturnType<typeof useSynth>;