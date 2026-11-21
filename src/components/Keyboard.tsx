import { useCallback, useMemo, useRef } from "react";
import type { ActiveNote } from "@/audio/engine";
import { KEY_LABEL, isBlackKey, noteName } from "@/audio/theory";
import { cn } from "@/utils/cn";

interface Props {
  baseOctave: number;
  notes: ActiveNote[];
  pool: number[];
  labels: boolean;
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
}

export function Keyboard({ baseOctave, notes, pool, labels, onNoteOn, onNoteOff }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());
  const base = baseOctave * 12 + 12;

  const keys = useMemo(() => {
    const list: { midi: number; black: boolean; whiteIndex: number; offset: number }[] = [];
    let whiteIndex = 0;
    for (let i = 0; i <= 24; i++) {
      const midi = base + i;
      const black = isBlackKey(midi);
      list.push({ midi, black, whiteIndex: black ? whiteIndex : whiteIndex++, offset: i });
    }
    return list;
  }, [base]);

  const whites = keys.filter((k) => !k.black);
  const blacks = keys.filter((k) => k.black);
  const wPct = 100 / whites.length;
  const activeMap = new Map(notes.map((n) => [n.midi, n]));
  const poolSet = new Set(pool);

  const keyFrom = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const target = el?.closest("[data-midi]") as HTMLElement | null;
    if (!target) return null;
    const midi = Number(target.dataset.midi);
    const r = target.getBoundingClientRect();
    const vel = Math.max(0.42, Math.min(1, 0.5 + ((y - r.top) / r.height) * 0.55));
    return { midi, vel };
  };

  const down = useCallback((e: React.PointerEvent) => {
    const hit = keyFrom(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    rootRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, hit.midi);
    onNoteOn(hit.midi, hit.vel);
  }, [onNoteOn]);

  const move = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const current = pointers.current.get(e.pointerId)!;
    const hit = keyFrom(e.clientX, e.clientY);
    if (!hit || hit.midi === current) return;
    pointers.current.set(e.pointerId, hit.midi);
    onNoteOff(current);
    onNoteOn(hit.midi, hit.vel);
  }, [onNoteOn, onNoteOff]);

  const up = useCallback((e: React.PointerEvent) => {
    const midi = pointers.current.get(e.pointerId);
    if (midi === undefined) return;
    pointers.current.delete(e.pointerId);
    rootRef.current?.releasePointerCapture?.(e.pointerId);
    onNoteOff(midi);
  }, [onNoteOff]);

  const renderCap = (offset: number, black: boolean, on: boolean) =>
    labels ? (
      <span
        className={cn(
          "readout pointer-events-none flex h-[15px] min-w-[15px] items-center justify-center rounded-[3px] border px-[3px] text-[8px] font-bold transition-colors",
          black
            ? on ? "border-amber bg-amber text-[#1a1206]" : "border-[#4a4353] bg-[#1b1824] text-[#b6adc2]"
            : on ? "border-[#8a4b00] bg-[#3a2308] text-amber" : "border-[#c3b8a4] bg-[#e3dac8] text-[#6d6355]",
        )}
      >
        {KEY_LABEL[offset] ?? ""}
      </span>
    ) : null;

  return (
    <div className="select-none">
      <div className="h-[7px] w-full rounded-t-[4px]" style={{ background: "linear-gradient(180deg,#8c1f3a,#4a0f20 60%,#2a0912)", boxShadow: "0 2px 6px #000a, inset 0 1px 0 #ff8faa33" }} />
      <div
        ref={rootRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="relative h-[132px] w-full touch-none overflow-hidden rounded-b-[8px] bg-[#0b0a0e] sm:h-[164px]"
        style={{ boxShadow: "inset 0 6px 14px -6px #000" }}
      >
        <div className="absolute inset-0 flex">
          {whites.map((k) => {
            const a = activeMap.get(k.midi);
            const on = !!a && !a.releasing;
            const rel = !!a && a.releasing;
            const queued = poolSet.has(k.midi);
            return (
              <div
                key={k.midi}
                data-midi={k.midi}
                className="relative flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1 border-r border-[#0d0c10] pb-2 transition-[transform,background,box-shadow] duration-75 last:border-r-0"
                style={{
                  background: on
                    ? "linear-gradient(180deg,#ffe0ad,#ff9c2b 62%,#e0700f)"
                    : rel
                      ? "linear-gradient(180deg,#f6e6cd,#dcc7a4 70%,#bda583)"
                      : "linear-gradient(180deg,#fbf6ea,#efe7d6 62%,#d8cdb8)",
                  boxShadow: on
                    ? "inset 0 -8px 18px -6px #7a3b00, 0 0 26px -4px #ff9c2b"
                    : "inset 0 -10px 14px -10px #6b5f4a, inset 0 2px 0 #fff",
                  transform: on ? "translateY(2px)" : "none",
                }}
              >
                {queued && <span className="pointer-events-none absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan shadow-[0_0_8px_#2ee6d6]" />}
                {renderCap(k.offset, false, on)}
                <span className={cn("readout pointer-events-none text-[8px] font-bold", on ? "text-[#4a2600]" : "text-[#8d8272]", k.offset % 12 === 0 ? "opacity-100" : "opacity-55")}>
                  {noteName(k.midi)}
                </span>
              </div>
            );
          })}
        </div>
        {blacks.map((k) => {
          const a = activeMap.get(k.midi);
          const on = !!a && !a.releasing;
          const rel = !!a && a.releasing;
          const queued = poolSet.has(k.midi);
          const left = k.whiteIndex * wPct;
          return (
            <div
              key={k.midi}
              data-midi={k.midi}
              className="absolute top-0 z-10 flex cursor-pointer flex-col items-center justify-end gap-1 rounded-b-[5px] pb-2 transition-[transform,background,box-shadow] duration-75"
              style={{
                left: `calc(${left}% - ${wPct * 0.31}%)`,
                width: `${wPct * 0.62}%`,
                height: "62%",
                background: on
                  ? "linear-gradient(180deg,#ffbe63,#ff8a12 55%,#b45200)"
                  : rel
                    ? "linear-gradient(180deg,#4b4351,#2a2532 60%,#171420)"
                    : "linear-gradient(180deg,#413a4b,#221e2b 45%,#0d0b12)",
                boxShadow: on
                  ? "0 0 26px -2px #ff9c2b, inset 0 -6px 10px -6px #5c2b00, 0 3px 5px #000b"
                  : "0 4px 7px #000c, inset 0 1px 0 #ffffff2e, inset 0 -3px 6px -3px #000",
                transform: on ? "translateY(2px)" : "none",
              }}
            >
              {queued && <span className="pointer-events-none absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan shadow-[0_0_8px_#2ee6d6]" />}
              {renderCap(k.offset, true, on)}
            </div>
          );
        })}
      </div>
    </div>
  );
}