"use client";

import { useEffect, useState, type CSSProperties } from "react";

const COLORS = ["#6a55ff", "#d4f56b", "#ffdccb", "#d6e8ff", "#ffd6e1", "#5841f0"];
const COUNT = 14;

function todayKey(id: string) {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `rayakan:${id}:${date}`;
}

/** Ledakan konfeti kecil, sekali per hari per `id`. Dilewati bila pengguna memilih "kurangi gerakan". */
export function Celebrate({ id }: { id: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = todayKey(id);
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    // Ditunda satu frame agar tidak setState sinkron di dalam effect.
    const raf = requestAnimationFrame(() => setShow(true));
    const t = window.setTimeout(() => setShow(false), 1200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [id]);

  if (!show) return null;
  return (
    <span aria-hidden data-testid="rayakan" className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2;
        const dist = 34 + (i % 3) * 12;
        const style = {
          "--dx": `${Math.round(Math.cos(angle) * dist)}px`,
          "--dy": `${Math.round(Math.sin(angle) * dist)}px`,
          "--rot": `${(i % 2 ? 1 : -1) * (90 + i * 20)}deg`,
          background: COLORS[i % COLORS.length],
          animation: `burst 900ms cubic-bezier(0.22, 1, 0.36, 1) ${(i % 4) * 30}ms both`,
        } as CSSProperties;
        return <span key={i} className="absolute size-1.5 rounded-[2px]" style={style} />;
      })}
    </span>
  );
}
