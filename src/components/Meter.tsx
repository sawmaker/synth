import { useEffect, useRef, useState } from "react";
import type { SynthEngine } from "@/audio/engine";

const SEGMENTS = 34;
const FLOOR = -54;

const toPos = (v: number) => {
  if (v <= 0.00001) return 0;
  const db = 20 * Math.log10(v);
  return Math.max(0, Math.min(1, (db - FLOOR) / -FLOOR));
};

export function Meter({ engine, live }: { engine: SynthEngine; live: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<HTMLSpanElement>(null);
  const [clip, setClip] = useState(false);
  const latched = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(40, Math.floor(r.width));
      h = Math.max(10, Math.floor(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let raf = 0;
    let peakHold = 0;
    let smooth = 0;
    let lastText = 0;
    let shownPeak = 0;

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const m = engine.meter();
      if (m.clip && !latched.current) { latched.current = true; setClip(true); }
      const rmsPos = toPos(m.rms * 1.35);
      const peakPos = toPos(m.peak);
      smooth += (rmsPos - smooth) * (rmsPos > smooth ? 0.55 : 0.12);
      peakHold = Math.max(peakPos, peakHold - 0.006);
      shownPeak = Math.max(m.peak, shownPeak * 0.94);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#08070c";
      ctx.fillRect(0, 0, w, h);

      const gap = 2;
      const sw = (w - gap * (SEGMENTS - 1)) / SEGMENTS;
      for (let i = 0; i < SEGMENTS; i++) {
        const pos = (i + 1) / SEGMENTS;
        const x = i * (sw + gap);
        const db = FLOOR + pos * -FLOOR;
        const color = db > -1.5 ? "#ff2f45" : db > -6 ? "#ff9c2b" : db > -18 ? "#b7f53c" : "#3fd48f";
        const lit = smooth >= pos - 0.5 / SEGMENTS;
        const peakLit = peakHold >= pos - 0.5 / SEGMENTS && peakHold > 0.02;
        ctx.fillStyle = lit ? color : "#191622";
        ctx.globalAlpha = lit ? 1 : 1;
        ctx.fillRect(x, 2, sw, h - 4);
        if (lit) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 7;
          ctx.fillRect(x, 2, sw, h - 4);
          ctx.shadowBlur = 0;
        } else if (peakLit) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(x, 2, sw, h - 4);
          ctx.globalAlpha = 1;
        }
      }
      // scale ticks
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (const db of [-48, -36, -24, -12, -6, -3, 0]) {
        const x = ((db - FLOOR) / -FLOOR) * w;
        ctx.fillRect(Math.min(w - 1, Math.max(0, x)), h - 2, 1, 2);
      }

      if (t - lastText > 90) {
        lastText = t;
        if (dbRef.current) dbRef.current.textContent = shownPeak <= 0.0001 ? "-∞" : (20 * Math.log10(shownPeak)).toFixed(1);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [engine]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="silk">Output · RMS + peak</span>
        <div className="flex items-center gap-2">
          <span className="readout text-[11px] font-bold text-lime"><span ref={dbRef}>-∞</span> dB</span>
          <button
            type="button"
            onClick={() => { latched.current = false; engine.clearClip(); setClip(false); }}
            title="Clipping indicator — click to reset"
            className="btn flex items-center gap-1 px-1.5 py-1 text-[9px]"
            style={clip ? { borderColor: "#ff2f45", color: "#ff2f45", background: "linear-gradient(180deg,#ff2f4533,#ff2f4512)", boxShadow: "0 0 16px -3px #ff2f45" } : undefined}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: clip ? "#ff2f45" : "#3a3444", boxShadow: clip ? "0 0 8px #ff2f45" : "none" }} />
            Clip
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="panel-inset h-[22px] w-full overflow-hidden p-[2px]">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      <div className="flex justify-between px-0.5">
        {[-54, -36, -24, -12, -6, 0].map((d) => (
          <span key={d} className="readout text-[8px] text-dim">{d}</span>
        ))}
      </div>
      {!live && <span className="silk text-[8px] text-amber">Engine idle — meter armed</span>}
    </div>
  );
}