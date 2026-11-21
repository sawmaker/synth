import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ panel */

export function Panel({
  index, title, accent = "#ff9c2b", children, className, right,
}: { index: string; title: string; accent?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={cn("panel grain overflow-hidden p-3.5 sm:p-4", className)}>
      <span className="screw left-1.5 top-1.5" />
      <span className="screw right-1.5 top-1.5" />
      <span className="screw bottom-1.5 left-1.5" />
      <span className="screw bottom-1.5 right-1.5" />
      <header className="mb-3 flex items-center gap-2 px-1.5">
        <span className="readout text-[9px] font-bold" style={{ color: accent }}>{index}</span>
        <h2 className="silk font-bold" style={{ color: accent, textShadow: `0 0 14px ${accent}55` }}>{title}</h2>
        <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }} />
        {right}
      </header>
      {children}
    </section>
  );
}

export function Led({ on, color = "#b7f53c", size = 7, pulse = false }: { on: boolean; color?: string; size?: number; pulse?: boolean }) {
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full transition-all duration-150", pulse && on && "led-pulse")}
      style={{
        width: size, height: size,
        background: on ? color : "#2b2733",
        boxShadow: on ? `0 0 ${size}px ${color}, 0 0 ${size * 2.4}px ${color}77, inset 0 0 2px #fff8` : "inset 0 1px 2px #000a",
      }}
    />
  );
}

/* ------------------------------------------------------------------- knob */

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  curve?: "lin" | "log";
  bipolar?: boolean;
  color?: string;
  size?: number;
  defaultValue?: number;
  step?: number;
  hint?: string;
}

export function Knob({
  label, value, min, max, onChange, format, curve = "lin", bipolar = false,
  color = "#ff9c2b", size = 58, defaultValue, step, hint,
}: KnobProps) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ y: 0, x: 0, n: 0 });

  const toNorm = useCallback((v: number) => {
    const n = curve === "log" ? Math.log(Math.max(v, min) / min) / Math.log(max / min) : (v - min) / (max - min);
    return Math.min(1, Math.max(0, n));
  }, [curve, min, max]);

  const fromNorm = useCallback((n: number) => {
    const c = Math.min(1, Math.max(0, n));
    let v = curve === "log" ? min * Math.pow(max / min, c) : min + c * (max - min);
    if (step) v = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, v));
  }, [curve, min, max, step]);

  const norm = toNorm(value);
  const A0 = -135;
  const angle = A0 + norm * 270;
  const pt = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return [50 + r * Math.sin(rad), 50 - r * Math.cos(rad)];
  };
  const arc = (n0: number, n1: number, r: number) => {
    const a0 = A0 + n0 * 270;
    const a1 = A0 + n1 * 270;
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const arcStart = bipolar ? 0.5 : 0;
  const [px, py] = pt(angle, 24);
  const [ix, iy] = pt(angle, 9);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, x: e.clientX, n: norm };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dy = drag.current.y - e.clientY;
    const dx = (e.clientX - drag.current.x) * 0.35;
    const scale = e.shiftKey ? 0.22 : 1;
    onChange(fromNorm(drag.current.n + ((dy + dx) / 190) * scale));
  };
  const endDrag = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      onChange(fromNorm(toNorm(value) + dir * (e.shiftKey ? 0.005 : 0.025)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [value, fromNorm, toNorm, onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = e.shiftKey ? 0.002 : 0.02;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); onChange(fromNorm(norm + big)); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); onChange(fromNorm(norm - big)); }
    else if (e.key === "Home" && defaultValue !== undefined) { e.preventDefault(); onChange(defaultValue); }
  };

  const display = format ? format(value) : value.toFixed(2);

  return (
    <div className="flex select-none flex-col items-center gap-1" title={hint}>
      <span className="silk text-center leading-tight">{label}</span>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={display}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        onKeyDown={onKeyDown}
        className={cn("relative touch-none rounded-full transition-transform", dragging ? "cursor-grabbing scale-105" : "cursor-grab")}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
          <defs>
            <radialGradient id={`cap${uid}`} cx="34%" cy="26%">
              <stop offset="0%" stopColor="#4a4453" />
              <stop offset="55%" stopColor="#26222e" />
              <stop offset="100%" stopColor="#131118" />
            </radialGradient>
            <linearGradient id={`shine${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 11 }).map((_, i) => {
            const a = A0 + (i / 10) * 270;
            const [x0, y0] = pt(a, 43);
            const [x1, y1] = pt(a, 47.5);
            const lit = i / 10 <= norm + 0.001;
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={lit ? color : "#4b4455"} strokeWidth={i % 5 === 0 ? 2.4 : 1.4} strokeLinecap="round" opacity={lit ? 0.95 : 0.55} />;
          })}
          <path d={arc(0, 1, 36)} fill="none" stroke="#100e15" strokeWidth={7} strokeLinecap="round" />
          <path d={arc(0, 1, 36)} fill="none" stroke="#332e3d" strokeWidth={5} strokeLinecap="round" />
          {Math.abs(norm - arcStart) > 0.002 && (
            <path
              d={arc(Math.min(arcStart, norm), Math.max(arcStart, norm), 36)}
              fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${color}cc)` }}
            />
          )}
          <circle cx="50" cy="50" r="29" fill={`url(#cap${uid})`} stroke="#0c0b10" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="29" fill={`url(#shine${uid})`} />
          <circle cx="50" cy="50" r="22" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1" />
          <line x1={ix} y1={iy} x2={px} y2={py} stroke={color} strokeWidth="3.4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          <circle cx="50" cy="50" r="3" fill="#0e0c12" stroke={color} strokeOpacity="0.5" strokeWidth="1" />
        </svg>
      </div>
      <span
        className="readout rounded px-1 text-[10px] font-medium tabular-nums transition-colors"
        style={{ color: dragging ? "#fff" : color, background: dragging ? `${color}22` : "transparent" }}
      >
        {display}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- toggles */

export function Toggle({
  label, on, onChange, color = "#b7f53c", className, hint,
}: { label: string; on: boolean; onChange: (v: boolean) => void; color?: string; className?: string; hint?: string }) {
  return (
    <button
      type="button"
      title={hint}
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn("btn flex items-center justify-center gap-1.5 px-2 py-1.5", className)}
      style={on ? { borderColor: color, color, background: `linear-gradient(180deg, ${color}2e, ${color}12)`, boxShadow: `inset 0 1px 0 #ffffff22, 0 0 14px -2px ${color}88` } : undefined}
    >
      <Led on={on} color={color} size={6} />
      {label}
    </button>
  );
}

export function Segmented<T extends string | number>({
  options, value, onChange, color = "#2ee6d6", className, size = "md",
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  color?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("panel-inset flex gap-0.5 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            title={o.title}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "readout flex-1 rounded-[6px] uppercase transition-all duration-150",
              size === "sm" ? "px-1.5 py-1 text-[9px]" : "px-2 py-1.5 text-[10px]",
              on ? "font-bold" : "text-dim hover:text-cream",
            )}
            style={on ? { color: "#0b0a0e", background: `linear-gradient(180deg, ${color}, ${color}bb)`, boxShadow: `0 0 16px -3px ${color}` } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  label, value, min, max, onChange, color = "#ff9c2b", suffix,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; color?: string; suffix?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="silk">{label}</span>
      <div className="panel-inset flex items-center gap-0.5 p-0.5">
        <button type="button" aria-label={`${label} down`} className="btn h-6 w-6 leading-none" onClick={() => onChange(Math.max(min, value - 1))}>–</button>
        <span className="readout w-9 text-center text-[12px] font-bold" style={{ color }}>{value}{suffix}</span>
        <button type="button" aria-label={`${label} up`} className="btn h-6 w-6 leading-none" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- fader */

export function Fader({
  value, onChange, color = "#ff9c2b", label,
}: { value: number; onChange: (v: number) => void; color?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const set = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height)));
  };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="silk">{label}</span>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        onPointerDown={(e) => { e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(true); set(e.clientY); }}
        onPointerMove={(e) => drag && set(e.clientY)}
        onPointerUp={(e) => { (e.target as Element).releasePointerCapture?.(e.pointerId); setDrag(false); }}
        onPointerCancel={() => setDrag(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(1, value + 0.02)); }
          if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, value - 0.02)); }
        }}
        className="panel-inset relative h-[104px] w-9 cursor-ns-resize touch-none"
      >
        <div className="absolute left-1/2 top-2 bottom-2 w-[5px] -translate-x-1/2 rounded-full bg-[#0a090d] shadow-[inset_0_0_4px_#000]" />
        <div
          className="absolute left-1/2 w-[5px] -translate-x-1/2 rounded-full"
          style={{ bottom: 8, height: `calc(${value * 100}% - ${value * 16}px)`, background: `linear-gradient(180deg, ${color}, ${color}44)`, boxShadow: `0 0 10px ${color}aa` }}
        />
        <div
          className="absolute left-1/2 h-4 w-8 -translate-x-1/2 rounded-[3px] border border-[#4b4455] transition-shadow"
          style={{
            bottom: `calc(${value * 100}% - ${value * 16}px + 0px)`,
            background: "linear-gradient(180deg,#514a5c,#221f2a 55%,#171420)",
            boxShadow: drag ? `0 0 14px ${color}, inset 0 1px 0 #ffffff33` : "0 2px 4px #000a, inset 0 1px 0 #ffffff22",
          }}
        >
          <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        </div>
      </div>
    </div>
  );
}