import { useEffect, useId, useRef, useState } from "react";
import type { SynthEngine, SynthParams } from "@/audio/engine";
import { formatTime } from "@/audio/theory";
import { cn } from "@/utils/cn";

const X0 = 14;
const XA = 100;
const XD = 192;
const XS = 250;
const X1 = 330;
const TOP = 16;
const BOT = 112;
const H = BOT - TOP;
const A_MAX = 3;
const D_MAX = 3;
const R_MAX = 5;

const shape = (v: number, max: number) => Math.sqrt(Math.max(0, Math.min(1, v / max)));
const unshape = (n: number, max: number) => Math.max(0, Math.min(1, n)) ** 2 * max;

type Handle = "A" | "D" | "S" | "R";

const SHAPES: { id: string; label: string; a: number; d: number; s: number; r: number }[] = [
  { id: "pluck", label: "Pluck", a: 0.002, d: 0.32, s: 0, r: 0.45 },
  { id: "keys", label: "Keys", a: 0.008, d: 0.7, s: 0.42, r: 0.55 },
  { id: "pad", label: "Pad", a: 0.85, d: 1.6, s: 0.8, r: 2.4 },
  { id: "drone", label: "Drone", a: 0.35, d: 0.6, s: 1, r: 1.2 },
  { id: "stab", label: "Stab", a: 0.003, d: 0.16, s: 0.15, r: 0.12 },
];

export function EnvelopeEditor({
  params, onChange, engine,
}: { params: SynthParams; onChange: <K extends keyof SynthParams>(k: K, v: SynthParams[K]) => void; engine: SynthEngine }) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const [drag, setDrag] = useState<Handle | null>(null);
  const [phase, setPhase] = useState<string>("—");
  const dragRef = useRef<Handle | null>(null);

  const { attack, decay, sustain, release, filterEnv } = params;
  const xa = X0 + shape(attack, A_MAX) * (XA - X0);
  const xd = XA + shape(decay, D_MAX) * (XD - XA);
  const xr = XS + shape(release, R_MAX) * (X1 - XS);
  const ys = BOT - sustain * H;

  const decayPath = `C ${xa + (xd - xa) * 0.2} ${TOP + (ys - TOP) * 0.82}, ${xa + (xd - xa) * 0.46} ${ys}, ${xd} ${ys}`;
  const releasePath = `C ${XS + (xr - XS) * 0.2} ${ys + (BOT - ys) * 0.82}, ${XS + (xr - XS) * 0.46} ${BOT}, ${xr} ${BOT}`;
  const curve = `M ${X0} ${BOT} L ${xa} ${TOP} ${decayPath} L ${XS} ${ys} ${releasePath}`;
  const area = `${curve} L ${xr} ${BOT} Z`;

  // filter-envelope ghost (bipolar, scaled by amount)
  const fBase = BOT - 4;
  const fTop = fBase - filterEnv * (H * 0.92);
  const fSus = fBase - filterEnv * sustain * (H * 0.92);
  const fCurve = `M ${X0} ${fBase} L ${xa} ${fTop} C ${xa + (xd - xa) * 0.2} ${fTop + (fSus - fTop) * 0.82}, ${xa + (xd - xa) * 0.46} ${fSus}, ${xd} ${fSus} L ${XS} ${fSus} C ${XS + (xr - XS) * 0.2} ${fSus + (fBase - fSus) * 0.82}, ${XS + (xr - XS) * 0.46} ${fBase}, ${xr} ${fBase}`;

  const local = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 344, y: ((e.clientY - r.top) / r.height) * 128 };
  };

  const apply = (h: Handle, x: number, y: number) => {
    if (h === "A") onChange("attack", Math.max(0.001, unshape((x - X0) / (XA - X0), A_MAX)));
    if (h === "D") onChange("decay", Math.max(0.005, unshape((x - XA) / (XD - XA), D_MAX)));
    if (h === "S") onChange("sustain", Math.max(0, Math.min(1, (BOT - y) / H)));
    if (h === "R") onChange("release", Math.max(0.01, unshape((x - XS) / (X1 - XS), R_MAX)));
  };

  const onDown = (h: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = h;
    setDrag(h);
  };
  const onMove = (e: React.PointerEvent) => {
    const h = dragRef.current;
    if (!h) return;
    const { x, y } = local(e);
    apply(h, x, y);
  };
  const onUp = (e: React.PointerEvent) => {
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setDrag(null);
  };

  const keyAdjust = (h: Handle) => (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? 0.02 : 0.08;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1;
    if (h === "A") onChange("attack", Math.max(0.001, unshape(shape(attack, A_MAX) + dir * s, A_MAX)));
    if (h === "D") onChange("decay", Math.max(0.005, unshape(shape(decay, D_MAX) + dir * s, D_MAX)));
    if (h === "S") onChange("sustain", Math.max(0, Math.min(1, sustain + dir * s)));
    if (h === "R") onChange("release", Math.max(0.01, unshape(shape(release, R_MAX) + dir * s, R_MAX)));
  };

  // live playhead driven straight from the audio clock
  useEffect(() => {
    let raf = 0;
    let lastPhase = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const f = engine.focus();
      const dot = dotRef.current;
      const glow = glowRef.current;
      const line = lineRef.current;
      if (!dot || !glow || !line) return;
      if (!f) {
        dot.style.opacity = "0";
        glow.style.opacity = "0";
        line.style.opacity = "0";
        if (lastPhase !== "—") { lastPhase = "—"; setPhase("—"); }
        return;
      }
      let x = X0;
      if (f.phase === "A") x = X0 + (xa - X0) * Math.min(1, f.age / Math.max(0.002, attack));
      else if (f.phase === "D") {
        const prog = 1 - Math.exp(-(f.age - attack) / (Math.max(0.01, decay) / 3));
        x = xa + (xd - xa) * Math.min(1, prog);
      } else if (f.phase === "R") {
        const prog = 1 - Math.exp(-f.relAge / (Math.max(0.012, release) / 4));
        x = XS + (xr - XS) * Math.min(1, prog);
      } else x = xd + (XS - xd) * Math.min(1, (f.age - attack - decay) / 1.2);
      const y = BOT - Math.max(0, Math.min(1, f.value)) * H;
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
      glow.setAttribute("cx", String(x));
      glow.setAttribute("cy", String(y));
      line.setAttribute("x1", String(X0));
      line.setAttribute("x2", String(x));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      dot.style.opacity = "1";
      glow.style.opacity = "0.55";
      line.style.opacity = "0.35";
      if (lastPhase !== f.phase) { lastPhase = f.phase; setPhase(f.phase); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, xa, xd, xr, attack, decay, release]);

  const handles: { id: Handle; x: number; y: number; label: string; value: string }[] = [
    { id: "A", x: xa, y: TOP, label: "Attack", value: formatTime(attack) },
    { id: "D", x: xd, y: ys, label: "Decay", value: formatTime(decay) },
    { id: "S", x: (xd + XS) / 2, y: ys, label: "Sustain", value: `${Math.round(sustain * 100)}%` },
    { id: "R", x: xr, y: BOT, label: "Release", value: formatTime(release) },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="panel-inset relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 344 128"
          className="block h-[132px] w-full touch-none select-none sm:h-[148px]"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <defs>
            <linearGradient id={`fill${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b7f53c" stopOpacity="0.42" />
              <stop offset="60%" stopColor="#b7f53c" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#b7f53c" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={`stroke${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b7f53c" />
              <stop offset="55%" stopColor="#2ee6d6" />
              <stop offset="100%" stopColor="#ff3d92" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={X0} x2={X1} y1={BOT - g * H} y2={BOT - g * H} stroke="#ffffff" strokeOpacity={g === 0 ? 0.14 : 0.06} strokeWidth="1" strokeDasharray={g === 0 ? "" : "2 4"} />
          ))}
          {[XA, XD, XS].map((gx, i) => (
            <g key={gx}>
              <line x1={gx} x2={gx} y1={TOP - 6} y2={BOT + 6} stroke="#ffffff" strokeOpacity="0.09" strokeDasharray="3 4" />
              <text x={gx - 4} y={BOT + 15} textAnchor="end" className="readout" fontSize="7" fill="#6f667c">{["A", "D", "S", "R"][i]}</text>
            </g>
          ))}
          <text x={X1} y={BOT + 15} textAnchor="end" className="readout" fontSize="7" fill="#6f667c">R</text>

          <path d={fCurve} fill="none" stroke="#2ee6d6" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="4 3" />
          <path d={area} fill={`url(#fill${uid})`} />
          <path d={curve} fill="none" stroke={`url(#stroke${uid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(183,245,60,0.55))" }} />

          <line ref={lineRef} x1={X0} x2={X0} y1={BOT} y2={BOT} stroke="#fff6d8" strokeWidth="1" strokeDasharray="2 3" style={{ opacity: 0 }} />
          <circle ref={glowRef} cx={X0} cy={BOT} r="9" fill="#fff3c4" style={{ opacity: 0, filter: "blur(5px)" }} />
          <circle ref={dotRef} cx={X0} cy={BOT} r="3.4" fill="#fffdf2" stroke="#ff9c2b" strokeWidth="1.4" style={{ opacity: 0 }} />

          {handles.map((h) => (
            <g key={h.id} className="cursor-grab" tabIndex={0} role="slider" aria-label={h.label} aria-valuetext={h.value} onKeyDown={keyAdjust(h.id)} onPointerDown={onDown(h.id)}>
              <circle cx={h.x} cy={h.y} r="13" fill="transparent" />
              <circle
                cx={h.x} cy={h.y} r={drag === h.id ? 7 : 5.4}
                fill={drag === h.id ? "#fffdf2" : "#191622"}
                stroke={h.id === "S" ? "#2ee6d6" : "#b7f53c"}
                strokeWidth="2"
                style={{ filter: `drop-shadow(0 0 ${drag === h.id ? 8 : 4}px ${h.id === "S" ? "#2ee6d6" : "#b7f53c"})`, transition: "r 120ms ease" }}
              />
              {drag === h.id && (
                <g>
                  <rect x={Math.min(292, Math.max(4, h.x - 24))} y={Math.max(2, h.y - 24)} width="48" height="15" rx="4" fill="#0d0b12" stroke="#b7f53c" strokeOpacity="0.5" />
                  <text x={Math.min(316, Math.max(28, h.x))} y={Math.max(12.5, h.y - 13)} textAnchor="middle" fontSize="9" className="readout" fill="#dfffa8">{h.value}</text>
                </g>
              )}
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5">
          <span className="silk">Phase</span>
          <span className={cn("readout rounded px-1.5 py-0.5 text-[10px] font-bold", phase === "—" ? "text-dim" : "bg-lime/15 text-lime")}>{phase}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {handles.map((h) => (
          <div key={h.id} className={cn("panel-inset px-1.5 py-1 text-center transition-colors", drag === h.id && "border-lime/60")}>
            <div className="silk text-[8px]">{h.label}</div>
            <div className="readout text-[11px] font-bold text-cream">{h.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="silk mr-0.5">Shape</span>
        {SHAPES.map((s) => {
          const on = Math.abs(attack - s.a) < 0.002 && Math.abs(decay - s.d) < 0.02 && Math.abs(sustain - s.s) < 0.02 && Math.abs(release - s.r) < 0.02;
          return (
            <button
              key={s.id}
              type="button"
              className={cn("btn px-2 py-1", on && "border-lime text-lime")}
              style={on ? { background: "linear-gradient(180deg,#b7f53c2e,#b7f53c12)", boxShadow: "0 0 14px -3px #b7f53c" } : undefined}
              onClick={() => { onChange("attack", s.a); onChange("decay", s.d); onChange("sustain", s.s); onChange("release", s.r); }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}