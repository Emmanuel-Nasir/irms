"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Slides its content in when it scrolls into view. */
export function Reveal({
  children,
  from = "up",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  from?: "up" | "left" | "right";
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const dir = from === "left" ? "irms-from-left" : from === "right" ? "irms-from-right" : "";
  return (
    <div
      ref={ref}
      className={`irms-reveal ${dir} ${shown ? "irms-shown" : ""} ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

/** Tilts in 3D towards the mouse pointer. */
export function Tilt({ children, className = "", max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(e: React.MouseEvent) {
    const el = ref.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateY(-4px)`;
  }
  function leave() {
    if (ref.current) ref.current.style.transform = "";
  }
  return (
    <div ref={ref} onMouseMove={move} onMouseLeave={leave} className={`irms-tilt ${className}`}>
      {children}
    </div>
  );
}

/** A clock that ticks every second, in Lagos time. */
export function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className={className}>&nbsp;</span>;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return (
    <span className={`tabular-nums ${className}`}>
      {get("hour")}
      <span className="irms-caret">:</span>
      {get("minute")}
      <span className="text-[0.6em] opacity-70">:{get("second")}</span>
    </span>
  );
}

/** Types its text out letter by letter. */
export function TypeOut({ text, speed = 45, className = "" }: { text: string; speed?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    setN(0);
    const t = setInterval(() => setN((i) => (i >= text.length ? (clearInterval(t), i) : i + 1)), speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      <span className="irms-caret ml-0.5 inline-block w-[2px] bg-current align-middle" style={{ height: "0.9em" }} />
    </span>
  );
}

/** A news-ticker strip that scrolls sideways. Hover to pause. */
export function Ticker({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const row = items.map((t, i) => (
    <span key={i} className="mx-6 inline-flex items-center gap-3 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      {t}
    </span>
  ));
  return (
    <div className="overflow-hidden">
      <div className="irms-marquee">
        <div className="flex">{row}</div>
        <div className="flex" aria-hidden="true">
          {row}
        </div>
      </div>
    </div>
  );
}

/** Animated waves along the bottom of a navy banner. */
export function Waves({ className = "" }: { className?: string }) {
  const path = "M0 30 C 150 60 350 0 500 30 C 650 60 850 0 1000 30 L 1000 80 L 0 80 Z";
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 overflow-hidden ${className}`}>
      <svg className="irms-wave-slow absolute bottom-0 h-full w-[200%] opacity-30" viewBox="0 0 2000 80" preserveAspectRatio="none">
        <path d={path} fill="#C9A227" />
        <path d={path} transform="translate(1000 0)" fill="#C9A227" />
      </svg>
      <svg className="irms-wave absolute bottom-0 h-3/4 w-[200%] opacity-60" viewBox="0 0 2000 80" preserveAspectRatio="none">
        <path d={path} fill="#FAF9F6" />
        <path d={path} transform="translate(1000 0)" fill="#FAF9F6" />
      </svg>
    </div>
  );
}
