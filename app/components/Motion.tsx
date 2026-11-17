"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Fixed values (not random) so the server and the browser draw the same thing
const SHAPES = [
  { left: 3, size: 10, dur: 24, delay: 0, shape: "dot" },
  { left: 9, size: 20, dur: 32, delay: 9, shape: "ring" },
  { left: 16, size: 9, dur: 22, delay: 14, shape: "diamond" },
  { left: 24, size: 14, dur: 28, delay: 4, shape: "plus" },
  { left: 31, size: 7, dur: 20, delay: 11, shape: "dot" },
  { left: 39, size: 24, dur: 36, delay: 18, shape: "ring" },
  { left: 47, size: 10, dur: 26, delay: 2, shape: "diamond" },
  { left: 55, size: 12, dur: 23, delay: 12, shape: "dot" },
  { left: 62, size: 16, dur: 31, delay: 6, shape: "plus" },
  { left: 70, size: 8, dur: 21, delay: 16, shape: "dot" },
  { left: 78, size: 22, dur: 34, delay: 3, shape: "ring" },
  { left: 85, size: 11, dur: 25, delay: 8, shape: "diamond" },
  { left: 92, size: 14, dur: 29, delay: 20, shape: "plus" },
  { left: 97, size: 8, dur: 22, delay: 5, shape: "dot" },
] as const;

/**
 * Softly moving lights and floating shapes, drawn behind the page content.
 * "light" for cream pages, "dark" for navy areas such as the sidebar.
 */
export function AnimatedBackground({
  tone = "light",
  fixed = true,
  shapes = true,
}: {
  tone?: "light" | "dark";
  fixed?: boolean;
  shapes?: boolean;
}) {
  const dark = tone === "dark";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${fixed ? "fixed" : "absolute"} inset-0 z-0 overflow-hidden`}
    >
      <div className={`irms-orb irms-orb-a -left-24 -top-24 h-96 w-96 ${dark ? "bg-gold/20" : "bg-gold/30"}`} />
      <div className={`irms-orb irms-orb-b -bottom-32 -right-20 h-[28rem] w-[28rem] ${dark ? "bg-navy-light" : "bg-navy/20"}`} />
      <div className={`irms-orb irms-orb-c left-1/3 top-1/3 h-72 w-72 ${dark ? "bg-sage/25" : "bg-sage/30"}`} />
      <div
        className="absolute inset-0"
        style={{
          opacity: dark ? 0.08 : 0.35,
          backgroundImage: `radial-gradient(${dark ? "rgba(250,249,246,0.9)" : "rgba(0,48,87,0.12)"} 1px, transparent 1px)`,
          backgroundSize: "26px 26px",
        }}
      />
      {shapes &&
        SHAPES.map((s, i) => {
          const style = {
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.dur}s`,
            animationDelay: `-${s.delay}s`,
            "--irms-o": dark ? 0.45 : 0.3,
            "--irms-spin": s.shape === "diamond" || s.shape === "plus" ? "320deg" : "0deg",
          } as CSSProperties;
          const color = dark ? "text-gold" : i % 2 ? "text-gold" : "text-navy/50";
          if (s.shape === "ring")
            return <span key={i} className={`irms-particle rounded-full border-2 border-current ${color}`} style={style} />;
          if (s.shape === "diamond")
            return <span key={i} className={`irms-particle rotate-45 bg-current ${color}`} style={style} />;
          if (s.shape === "plus")
            return (
              <span key={i} className={`irms-particle ${color}`} style={style}>
                <svg viewBox="0 0 10 10" width="100%" height="100%">
                  <path d="M5 0v10M0 5h10" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
            );
          return <span key={i} className={`irms-particle rounded-full bg-current ${color}`} style={style} />;
        })}
    </div>
  );
}

/** A number that counts up from 0 when it first appears (and to each new value after). */
export function CountUp({ value, suffix = "", duration = 1200 }: { value: number; suffix?: string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + (value - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {shown.toLocaleString()}
      {suffix}
    </span>
  );
}

/** A progress ring that fills up when it appears. */
export function ProgressRing({
  percent,
  size = 96,
  stroke = 9,
  color = "#5B8266",
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const full = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,48,87,0.1)" strokeWidth={stroke} />
        <circle
          className="irms-ring"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={full}
          strokeDashoffset={full * (1 - clamped / 100)}
          style={{ "--irms-ring-full": full } as CSSProperties}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-xl leading-none text-navy">
          <CountUp value={Math.round(clamped)} suffix="%" />
        </p>
        {label && <p className="mt-0.5 text-[10px] uppercase tracking-wider text-navy/50">{label}</p>}
      </div>
    </div>
  );
}

/** Small bar chart; bars grow up one after another. */
export function BarChart({
  data,
  height = 120,
  color = "bg-navy",
  highlightLast = true,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const last = highlightLast && i === data.length - 1;
          return (
            <div key={d.label + i} className="group flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
              <span className="mb-1 text-[10px] font-semibold text-navy/60 opacity-0 transition-opacity group-hover:opacity-100">
                {d.value}
              </span>
              <div
                className={`irms-bar w-full rounded-t-md ${last ? "bg-gold" : color} transition-all group-hover:brightness-125`}
                style={{
                  height: `${Math.max(4, (d.value / max) * 100)}%`,
                  animationDelay: `${i * 0.06}s`,
                  opacity: d.value === 0 ? 0.25 : 1,
                }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span key={d.label + i} className="flex-1 truncate text-center text-[10px] text-navy/50">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A horizontal meter that fills from the left. */
export function Meter({ percent, color = "bg-sage", delay = 0 }: { percent: number; color?: string; delay?: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-navy/10">
      <div
        className={`irms-meter h-full rounded-full ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%`, animationDelay: `${delay}s` }}
      />
    </div>
  );
}
