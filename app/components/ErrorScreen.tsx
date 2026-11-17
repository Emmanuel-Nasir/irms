"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, RotateCcw } from "lucide-react";
import { AnimatedBackground } from "@/app/components/Motion";
import { IrmsMark, StakeLogo } from "@/app/components/Brand";

/**
 * The look shared by every error page: a big animated code, a plain-words message, and ways out.
 * "full" fills the screen in navy (outside the dashboard); otherwise it sits inside the dashboard.
 */
export default function ErrorScreen({
  code,
  title,
  message,
  onRetry,
  reference,
  full = true,
}: {
  code: string;
  title: string;
  message: string;
  onRetry?: () => void;
  reference?: string;
  full?: boolean;
}) {
  const router = useRouter();

  const buttons = (
    <div className="irms-enter-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "0.45s" }}>
      {onRetry && (
        <button
          onClick={onRetry}
          className="irms-shine flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy shadow-lg transition-transform hover:scale-105"
        >
          <RotateCcw size={16} /> Try again
        </button>
      )}
      <Link
        href="/dashboard"
        className={`irms-shine flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg transition-transform hover:scale-105 ${
          onRetry ? (full ? "bg-white/10 text-parchment" : "bg-navy text-parchment") : "bg-gold text-navy"
        }`}
      >
        <Home size={16} /> Go to my dashboard
      </Link>
      <button
        onClick={() => router.back()}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
          full ? "text-parchment/70 hover:text-parchment" : "text-navy/60 hover:text-navy"
        }`}
      >
        <ArrowLeft size={16} /> Go back
      </button>
    </div>
  );

  const digits = (
    <div className="irms-enter-down relative flex items-center justify-center" aria-hidden="true">
      <span className="irms-pulse-ring absolute h-40 w-40 rounded-full border-2 border-gold/50" />
      <span className="irms-spin-slow absolute h-56 w-56 rounded-full border border-dashed border-gold/30" />
      <p
        className={`irms-float relative font-display text-8xl font-bold tracking-tight sm:text-9xl ${
          full ? "text-parchment" : "text-navy"
        }`}
        style={{ textShadow: "0 10px 40px rgba(201,162,39,0.45)" }}
      >
        {code.split("").map((ch, i) => (
          <span key={i} className="irms-bob inline-block" style={{ animationDelay: `${-i * 1.2}s` }}>
            {ch}
          </span>
        ))}
      </p>
    </div>
  );

  const text = (
    <>
      <h1
        className={`irms-enter-up mt-10 font-display text-3xl sm:text-4xl ${full ? "text-parchment" : "text-navy"}`}
        style={{ animationDelay: "0.2s" }}
      >
        {title}
      </h1>
      <p
        className={`irms-enter-up mx-auto mt-3 max-w-md text-sm leading-relaxed sm:text-base ${
          full ? "text-parchment/70" : "text-navy/65"
        }`}
        style={{ animationDelay: "0.3s" }}
      >
        {message}
      </p>
      {reference && (
        <p className={`mt-4 font-mono text-[11px] ${full ? "text-parchment/35" : "text-navy/35"}`}>Reference: {reference}</p>
      )}
    </>
  );

  if (!full) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
        <div className="text-center">
          {digits}
          {text}
          {buttons}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-4 py-12 text-center">
      <AnimatedBackground tone="dark" />
      <div className="relative z-10">
        <div className="irms-enter-down mb-12 flex items-center justify-center gap-3">
          <StakeLogo size={44} />
          <span className="flex items-center gap-1.5">
            <IrmsMark size={22} />
            <span className="font-display text-xl tracking-wide text-parchment">IRMS</span>
          </span>
        </div>
        {digits}
        {text}
        {buttons}
      </div>
      <div className="irms-shimmer-bar absolute inset-x-0 bottom-0 h-1" />
    </div>
  );
}
