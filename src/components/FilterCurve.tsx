import { useId, useRef, useState } from "react";

const W = 300;
const H = 104;
const FMIN = 20;
const FMAX = 20000;
const LR = Math.log(FMAX / FMIN);
const DB_TOP = 24;
const DB_BOT = -42;

const xOf = (f: number) => (Math.log(f / FMIN) / LR) * W;
const fOf = (x: number) => FMIN * Math.exp((Math.max(0, Math.min(W, x)) / W) * LR);
const yOf = (db: number) => H - ((Math.max(DB_BOT, Math.min(DB_TOP, db)) - DB_BOT) / (DB_TOP - DB_BOT)) * H;

/** RBJ low-pass magnitude response (matches BiquadFilterNode "lowpass") */
function magAt(f: number, cutoff: number, q: number, fs: number) {
  const w0 = (2 * Math.PI * Math.min(cutoff, fs * 0.49)) / fs;
  const cw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(0.0001, q));
  const b0 = (1 - cw) / 2;
  const b1 = 1 - cw;
  const b2 = b0;
  const a0 = 1 + alpha;
  const a1 = -2 * cw;
  const a2 = 1 - alpha;
  const w = (2 * Math.PI * f) / fs;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2;
  const ni = -(b1 * s1 + b2 * s2);
  const dr = a0 + a1 * c1 + a2 * c2;
  const di = -(a1 * s1 + a2 * s2);
  return Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
}

export function FilterCurve({
  cutoff, resonance, slope, sampleRate, onChange,
}: {
  cutoff: number;
  resonance: number;
  slope: 12 | 24;
  sampleRate: number;
  onChange: (patch: { cutoff?: number; resonance?: number }) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);
  const dragging = useRef(false);

  const pts: string[] = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const f = FMIN * Math.exp((i / N) * LR);
    let m = magAt(f, cutoff, resonance, sampleRate);
    if (slope === 24) m *= magAt(f, cutoff, Math.max(0.0001, resonance * 0.55), sampleRate);
    const db = 20 * Math.log10(Math.max(1e-6, m));
    pts.push(`${((i / N) * W).toFixed(2)} ${yOf(db).toFixed(2)}`);
  }
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  let peakDb = 20 * Math.log10(Math.max(1e-6, magAt(cutoff, cutoff, resonance, sampleRate) * (slope === 24 ? magAt(cutoff, cutoff, resonance * 0.55, sampleRate) : 1)));
  if (!isFinite(peakDb)) peakDb = 0;
  const cx = xOf(cutoff);
  const cy = yOf(peakDb);

  const set = (e: React.PointerEvent) => {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const db = DB_BOT + (1 - y / H) * (DB_TOP - DB_BOT);
    const q = Math.max(0.3, Math.min(18, Math.pow(10, (db - 1) / 17)));
    onChange({ cutoff: Math.round(fOf(x)), resonance: Number(q.toFixed(2)) });
  };

  return (
    <div className="panel-inset relative overflow-hidden">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-[104px] w-full cursor-crosshair touch-none"
        onPointerDown={(e) => { e.preventDefault(); dragging.current = true; setDrag(true); ref.current?.setPointerCapture(e.pointerId); set(e); }}
        onPointerMove={(e) => dragging.current && set(e)}
        onPointerUp={(e) => { dragging.current = false; setDrag(false); ref.current?.releasePointerCapture?.(e.pointerId); }}
        onPointerCancel={() => { dragging.current = false; setDrag(false); }}
      >
        <defs>
          <linearGradient id={`fg${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2ee6d6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2ee6d6" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[100, 1000, 10000].map((f) => (
          <g key={f}>
            <line x1={xOf(f)} x2={xOf(f)} y1="0" y2={H} stroke="#ffffff" strokeOpacity="0.07" strokeDasharray="2 4" />
            <text x={xOf(f) + 3} y={H - 4} fontSize="7" className="readout" fill="#6f667c">{f >= 1000 ? `${f / 1000}k` : f}</text>
          </g>
        ))}
        <line x1="0" x2={W} y1={yOf(0)} y2={yOf(0)} stroke="#ffffff" strokeOpacity="0.12" />
        <text x="3" y={yOf(0) - 3} fontSize="7" className="readout" fill="#6f667c">0 dB</text>
        <path d={area} fill={`url(#fg${uid})`} />
        <path d={line} fill="none" stroke="#2ee6d6" strokeWidth="2" style={{ filter: "drop-shadow(0 0 6px #2ee6d6aa)" }} />
        <line x1={cx} x2={cx} y1="0" y2={H} stroke="#ff9c2b" strokeOpacity="0.5" strokeDasharray="3 3" />
        <circle cx={cx} cy={cy} r={drag ? 7 : 5.5} fill={drag ? "#fffdf2" : "#0f0d14"} stroke="#ff9c2b" strokeWidth="2" style={{ filter: "drop-shadow(0 0 6px #ff9c2b)" }} />
        <text x="4" y="10" fontSize="7" className="readout" fill="#6f667c">LPF RESPONSE · DRAG FREQ ↔ RES</text>
        <text x={cx > W - 70 ? cx - 9 : cx + 9} y={Math.max(22, Math.min(H - 12, cy - 9))} fontSize="8" textAnchor={cx > W - 70 ? "end" : "start"} className="readout" fill="#ffc27a">
          {cutoff >= 1000 ? `${(cutoff / 1000).toFixed(2)}kHz` : `${Math.round(cutoff)}Hz`} · Q{resonance.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}