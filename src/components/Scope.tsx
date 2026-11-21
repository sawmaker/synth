import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ActiveNote, SynthEngine } from "@/audio/engine";
import { noteName } from "@/audio/theory";
import { Knob, Led, Segmented, Toggle } from "./ui";

export type ScopeMode = "split" | "wave" | "spectrum";

const FMIN = 20;
const FMAX = 20000;
const LOG_RANGE = Math.log(FMAX / FMIN);
const GRID_F = [30, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const fmtF = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

interface Props {
  engine: SynthEngine;
  notes: ActiveNote[];
  live: boolean;
  onPower: () => void;
  octaveShift: number;
}

export function Scope({ engine, notes, live, onPower, octaveShift }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const peakRef = useRef<HTMLSpanElement>(null);

  const [mode, setMode] = useState<ScopeMode>("split");
  const [grid, setGrid] = useState(true);
  const [trails, setTrails] = useState(true);
  const [frozen, setFrozen] = useState(false);
  const [trig, setTrig] = useState(0);
  const [span, setSpan] = useState(1024);
  const [vgain, setVgain] = useState(1.6);

  const props = useRef({ mode, grid, trails, frozen, trig, span, vgain, notes, live, octaveShift });
  props.current = { mode, grid, trails, frozen, trig, span, vgain, notes, live, octaveShift };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const size = { w: 0, h: 0, dpr: 1 };
    const gradCache = new Map<string, CanvasGradient>();
    let vignette: CanvasGradient | null = null;
    const resize = () => {
      gradCache.clear();
      vignette = null;
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.w = Math.max(80, Math.floor(r.width));
      size.h = Math.max(80, Math.floor(r.height));
      size.dpr = dpr;
      canvas.width = Math.floor(size.w * dpr);
      canvas.height = Math.floor(size.h * dpr);
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
      peaks = new Float32Array(size.w);
    };
    let peaks = new Float32Array(1);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // scanline pattern (built once)
    const pat = document.createElement("canvas");
    pat.width = 1;
    pat.height = 3;
    const pctx = pat.getContext("2d")!;
    pctx.fillStyle = "rgba(0,0,0,0.30)";
    pctx.fillRect(0, 0, 1, 1);
    const scan = ctx.createPattern(pat, "repeat");

    const history: Float32Array[] = [];
    let raf = 0;
    let frames = 0;
    let fpsAt = performance.now();
    let peakHold = 0;
    let peakAt = 0;
    let frameNo = 0;

    const bg = (x: number, y: number, w: number, h: number, tint: string) => {
      const key = `b${x},${y},${w},${h},${tint}`;
      let g = gradCache.get(key);
      if (!g) {
        const lg = ctx.createLinearGradient(0, y, 0, y + h);
        lg.addColorStop(0, "#0a0b10");
        lg.addColorStop(0.55, "#070810");
        lg.addColorStop(1, "#05060a");
        gradCache.set(key, lg);
        g = lg;
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      const rkey = `r${key}`;
      let rg = gradCache.get(rkey);
      if (!rg) {
        const rad = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.62);
        rad.addColorStop(0, tint);
        rad.addColorStop(1, "rgba(0,0,0,0)");
        gradCache.set(rkey, rad);
        rg = rad;
      }
      ctx.fillStyle = rg;
      ctx.fillRect(x, y, w, h);
    };

    const label = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = "left", size = 9) => {
      ctx.font = `500 ${size}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    /* ---------------------------------------------------------- waveform */
    const drawWave = (x: number, y: number, w: number, h: number, t: number) => {
      const p = props.current;
      bg(x, y, w, h, "rgba(46,230,214,0.07)");
      const mid = y + h / 2;
      const half = (h / 2) * 0.88;

      if (p.grid) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(120,200,220,0.075)";
        ctx.beginPath();
        for (let i = 1; i < 12; i++) { const gx = Math.round(x + (w * i) / 12) + 0.5; ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
        for (let i = 1; i < 8; i++) { const gy = Math.round(y + (h * i) / 8) + 0.5; ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
        ctx.stroke();
        ctx.strokeStyle = "rgba(46,230,214,0.20)";
        ctx.beginPath();
        ctx.moveTo(x, Math.round(mid) + 0.5);
        ctx.lineTo(x + w, Math.round(mid) + 0.5);
        ctx.moveTo(Math.round(x + w / 2) + 0.5, y);
        ctx.lineTo(Math.round(x + w / 2) + 0.5, y + h);
        ctx.stroke();
      }

      const data = engine.sampleTime();
      const n = Math.min(Math.round(p.span), data ? data.length : 2048);
      const seg = new Float32Array(n);
      let triggerIdx = 0;
      let locked = false;

      if (data && p.live) {
        const level = p.trig;
        const hyst = 0.006;
        const limit = Math.max(1, data.length - n - 1);
        for (let i = 1; i < limit; i++) {
          if (data[i - 1] <= level && data[i] > level && data[i + 1] > data[i] + hyst * 0.2) { triggerIdx = i; locked = true; break; }
        }
        for (let i = 0; i < n; i++) seg[i] = data[triggerIdx + i] ?? 0;
      } else {
        // standby: slow breathing Lissajous-ish idle trace
        for (let i = 0; i < n; i++) {
          const u = i / n;
          seg[i] = (Math.sin(u * Math.PI * 6 + t * 0.0011) * 0.34 + Math.sin(u * Math.PI * 2 - t * 0.0006) * 0.16) * (0.55 + 0.45 * Math.sin(t * 0.0007));
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      const gain = p.vgain;
      const trace = (buf: Float32Array, alpha: number, width: number, color: string) => {
        const step = Math.max(1, Math.floor(buf.length / Math.max(80, w * 1.4)));
        ctx.beginPath();
        for (let i = 0; i < buf.length; i += step) {
          const px = x + (i / (buf.length - 1)) * w;
          const py = mid - Math.max(-1.6, Math.min(1.6, buf[i] * gain)) * half;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.globalAlpha = 1;
      };

      if (p.trails) {
        if (frameNo % 2 === 0) {
          history.unshift(seg);
          if (history.length > 6) history.pop();
        }
        for (let i = history.length - 1; i >= 1; i--) trace(history[i], 0.05 + 0.05 * (6 - i), 1.4, "#2ee6d6");
      } else history.length = 0;

      // phosphor bloom without costly shadowBlur: wide translucent passes
      trace(seg, 0.09, 10, "#2ee6d6");
      trace(seg, 0.2, 4.5, "#2ee6d6");
      trace(seg, p.live ? 0.95 : 0.55, 2, "#54f2e4");
      trace(seg, 0.85, 0.9, "#e9fffb");

      // trigger marker
      const ty = mid - p.trig * gain * half;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = "rgba(255,156,43,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, ty);
      ctx.lineTo(x + w, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ff9c2b";
      ctx.beginPath();
      ctx.moveTo(x, ty - 5);
      ctx.lineTo(x + 7, ty);
      ctx.lineTo(x, ty + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const ms = ((n / (engine.sampleRate || 48000)) * 1000).toFixed(1);
      label("TIME DOMAIN", x + 10, y + 12, "rgba(46,230,214,0.85)", "left", 9);
      label(`${ms} ms WINDOW · ${n} PT`, x + w - 10, y + 12, "rgba(156,147,168,0.75)", "right", 9);
      label(locked ? "TRIG LOCK ↑" : "FREE RUN", x + 10, y + h - 11, locked ? "rgba(183,245,60,0.9)" : "rgba(255,156,43,0.7)", "left", 9);
      ctx.strokeStyle = "rgba(46,230,214,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    /* ---------------------------------------------------------- spectrum */
    const drawSpectrum = (x: number, y: number, w: number, h: number, t: number) => {
      const p = props.current;
      bg(x, y, w, h, "rgba(255,61,146,0.06)");
      const top = y + 12;
      const bottom = y + h - 16;
      const ph = bottom - top;

      if (p.grid) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(180,160,200,0.08)";
        ctx.beginPath();
        for (const f of GRID_F) {
          const gx = Math.round(x + (Math.log(f / FMIN) / LOG_RANGE) * w) + 0.5;
          ctx.moveTo(gx, top); ctx.lineTo(gx, bottom);
        }
        for (const db of [-20, -40, -60, -80]) {
          const gy = Math.round(top + ((db + 100) / 100) * ph * -1 + ph) + 0.5;
          ctx.moveTo(x, gy); ctx.lineTo(x + w, gy);
        }
        ctx.stroke();
        for (const f of GRID_F) {
          const gx = x + (Math.log(f / FMIN) / LOG_RANGE) * w;
          if (gx > x + 8 && gx < x + w - 8) label(fmtF(f), gx, bottom + 8, "rgba(156,147,168,0.6)", "center", 8);
        }
        for (const db of [-20, -60]) {
          const gy = top + ((db + 100) / 100) * ph * -1 + ph;
          label(`${db}`, x + 6, gy - 5, "rgba(156,147,168,0.45)", "left", 8);
        }
      }

      const data = engine.sampleSpectrum();
      const bins = data ? data.length : 2048;
      const binHz = (engine.sampleRate || 48000) / 2 / bins;
      if (peaks.length !== w) peaks = new Float32Array(w);

      const cols = Math.max(2, Math.floor(w));
      const values = new Float32Array(cols);
      for (let i = 0; i < cols; i++) {
        const f0 = FMIN * Math.exp((i / cols) * LOG_RANGE);
        const f1 = FMIN * Math.exp(((i + 1) / cols) * LOG_RANGE);
        let b0 = Math.floor(f0 / binHz);
        let b1 = Math.max(b0 + 1, Math.ceil(f1 / binHz));
        b0 = Math.max(0, Math.min(bins - 1, b0));
        b1 = Math.max(b0 + 1, Math.min(bins, b1));
        let db = -140;
        if (data && p.live) {
          for (let b = b0; b < b1; b++) if (data[b] > db) db = data[b];
        } else {
          const u = i / cols;
          db = -96 + Math.sin(u * 22 + t * 0.0009) * 3 + Math.sin(u * 5 - t * 0.0004) * 4 - u * 6;
        }
        values[i] = Math.max(0, Math.min(1, (db + 100) / 100));
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, top - 10, w, ph + 12);
      ctx.clip();

      const grad = ctx.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, "rgba(255,61,146,0.85)");
      grad.addColorStop(0.32, "rgba(255,156,43,0.65)");
      grad.addColorStop(0.62, "rgba(183,245,60,0.45)");
      grad.addColorStop(1, "rgba(46,230,214,0.16)");

      ctx.beginPath();
      ctx.moveTo(x, bottom);
      for (let i = 0; i < cols; i++) ctx.lineTo(x + (i / (cols - 1)) * w, bottom - values[i] * ph);
      ctx.lineTo(x + w, bottom);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const px = x + (i / (cols - 1)) * w;
        const py = bottom - values[i] * ph;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(255,156,43,0.22)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "#ffd9a8";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // peak hold
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        peaks[i] = Math.max(values[i], peaks[i] - 0.0055);
        const px = x + (i / (cols - 1)) * w;
        const py = bottom - peaks[i] * ph;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.max(1, w / cols), py);
      }
      ctx.strokeStyle = "rgba(255,61,146,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // active partial markers
      const shown = p.notes.filter((nn) => !nn.releasing).slice(0, 8);
      for (const nn of shown) {
        const f = 440 * Math.pow(2, (nn.midi + p.octaveShift * 12 - 69) / 12);
        if (f < FMIN || f > FMAX) continue;
        const px = x + (Math.log(f / FMIN) / LOG_RANGE) * w;
        ctx.strokeStyle = "rgba(255,156,43,0.28)";
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        label(noteName(nn.midi), px, top - 4, "rgba(255,196,120,0.95)", "center", 8);
      }
      ctx.restore();

      label("SPECTRUM · LOG FFT 4096", x + 10, y + 12, "rgba(255,61,146,0.85)", "left", 9);
      label("20 Hz → 20 kHz", x + w - 10, y + 12, "rgba(156,147,168,0.75)", "right", 9);
      ctx.strokeStyle = "rgba(255,61,146,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const p = props.current;
      if (p.frozen) return;
      const { w, h, dpr } = size;
      if (!w || !h) return;
      frameNo++;
      frames++;
      if (t - fpsAt > 500) {
        if (fpsRef.current) fpsRef.current.textContent = String(Math.round((frames * 1000) / (t - fpsAt)));
        frames = 0;
        fpsAt = t;
        const m = engine.meter();
        if (m.peak > peakHold || t - peakAt > 900) { peakHold = m.peak; peakAt = t; }
        if (peakRef.current) peakRef.current.textContent = peakHold <= 0.0001 ? "-∞" : (20 * Math.log10(peakHold)).toFixed(1);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#06060a";
      ctx.fillRect(0, 0, w, h);

      const pad = 8;
      const iw = w - pad * 2;
      if (p.mode === "wave") drawWave(pad, pad, iw, h - pad * 2, t);
      else if (p.mode === "spectrum") drawSpectrum(pad, pad, iw, h - pad * 2, t);
      else {
        const hh = Math.round((h - pad * 2 - 6) * 0.52);
        drawWave(pad, pad, iw, hh, t);
        drawSpectrum(pad, pad + hh + 6, iw, h - pad * 2 - hh - 6, t);
      }

      if (scan) {
        ctx.fillStyle = scan;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      if (!vignette) {
        vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.55)");
      }
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engine]);

  const snapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `volta24-scope-${Date.now()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  return (
    <section className="panel grain flex flex-col overflow-hidden p-3 sm:p-4">
      <span className="screw left-1.5 top-1.5" />
      <span className="screw right-1.5 top-1.5" />
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-1.5">
        <div className="flex items-center gap-2">
          <span className="readout text-[9px] font-bold text-cyan">01</span>
          <h2 className="silk font-bold text-cyan" style={{ textShadow: "0 0 14px #2ee6d655" }}>Oscilloscope</h2>
        </div>
        <Segmented
          className="min-w-[210px] flex-1 sm:flex-none"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: "split", label: "Split", title: "Waveform + spectrum" },
            { value: "wave", label: "Wave", title: "Triggered time domain" },
            { value: "spectrum", label: "FFT", title: "Logarithmic spectrum" },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <Toggle label="Grid" on={grid} onChange={setGrid} color="#2ee6d6" />
          <Toggle label="Trails" on={trails} onChange={setTrails} color="#a78bfa" />
          <Toggle label="Freeze" on={frozen} onChange={setFrozen} color="#ff9c2b" />
          <button type="button" className="btn px-2 py-1.5" onClick={snapshot} title="Download the current scope frame as PNG">Snap</button>
        </div>
        <div className="ml-auto flex items-center gap-2 pr-1">
          <Led on={live} color="#ff2f45" pulse={live} />
          <span className="readout text-[10px] text-dim"><span ref={fpsRef}>60</span> FPS</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <div className="panel-inset relative min-w-0 flex-1 overflow-hidden">
          <div ref={wrapRef} className="h-[240px] w-full sm:h-[300px] lg:h-[352px]">
            <canvas ref={canvasRef} className="block h-full w-full" />
          </div>
          {!live && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05060a]/55 backdrop-blur-[1px]">
              <p className="silk text-[10px] text-cyan">Audio engine standby</p>
              <button
                type="button"
                onClick={onPower}
                className="btn border-amber px-5 py-2.5 text-[11px] font-bold text-amber"
                style={{ boxShadow: "0 0 26px -6px #ff9c2b, inset 0 1px 0 #ffffff22" }}
              >
                ⏻ Power on
              </button>
              <p className="readout max-w-[280px] text-center text-[9px] leading-relaxed text-dim">
                Browsers require a gesture to start audio. Then play with your mouse or the QWERTY keys.
              </p>
            </div>
          )}
          {frozen && (
            <div className="pointer-events-none absolute right-3 top-3 rounded border border-amber/60 bg-[#1a1206]/80 px-2 py-1">
              <span className="readout text-[9px] font-bold text-amber">HOLD</span>
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-row items-center justify-around gap-1 sm:w-[74px] sm:flex-col sm:justify-between">
          <Knob label="Trig" value={trig} min={-0.6} max={0.6} defaultValue={0} bipolar color="#ff9c2b" size={50} onChange={setTrig} format={(v) => v.toFixed(2)} hint="Trigger level for the rising-edge waveform lock" />
          <Knob label="Span" value={span} min={128} max={2048} defaultValue={1024} step={1} color="#2ee6d6" size={50} onChange={setSpan} format={(v) => `${Math.round(v)}`} hint="Samples shown in the time window" />
          <Knob label="Vert" value={vgain} min={0.4} max={5} defaultValue={1.6} color="#b7f53c" size={50} onChange={setVgain} format={(v) => `${v.toFixed(2)}×`} hint="Vertical gain of the time-domain trace" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1.5">
        <Readout label="Peak" value={<><span ref={peakRef}>-∞</span> dB</>} color="#b7f53c" />
        <Readout label="Rate" value={`${(engine.sampleRate / 1000).toFixed(1)} kHz`} color="#2ee6d6" />
        <Readout label="FFT" value="4096 / HANN" color="#ff3d92" />
        <Readout label="Trigger" value={trig === 0 ? "ZERO ↑" : `${trig > 0 ? "+" : ""}${trig.toFixed(2)} ↑`} color="#ff9c2b" />
        <span className="readout ml-auto hidden text-[9px] text-dim md:inline">DRAG KNOBS · SHIFT = FINE · DBL-CLICK = RESET</span>
      </div>
    </section>
  );
}

function Readout({ label, value, color }: { label: string; value: ReactNode; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="silk">{label}</span>
      <span className="readout text-[11px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}