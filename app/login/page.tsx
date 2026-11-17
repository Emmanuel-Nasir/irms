"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BookOpen, CircleAlert, Eye, EyeOff, GraduationCap, LoaderCircle, Lock, Mail, QrCode,
} from "lucide-react";
import { IrmsMark, StakeLogo } from "@/app/components/Brand";

const REMEMBER_KEY = "irms:email";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

const FEATURES = [
  { icon: QrCode, text: "Check in to class with a quick scan" },
  { icon: BookOpen, text: "See your classes, schedule and announcements" },
  { icon: GraduationCap, text: "Follow your progress towards graduation" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Already signed in on this device? Go straight on.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => {
        if (me) router.replace(nextPath());
        else setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));

    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) setEmail(saved);
    } catch {
      // Storage can be unavailable (private browsing); remembering is only a convenience
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const cleanEmail = email.trim();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, cleanEmail.toLowerCase());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {}
      router.replace(nextPath());
    } catch {
      setError("Couldn't reach IRMS. Check your internet connection and try again.");
      setLoading(false);
    }
  }

  function watchCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  }

  const field =
    "w-full rounded-md border border-navy/15 bg-white py-2.5 pl-10 pr-3 text-navy outline-none transition placeholder:text-navy/30 focus:border-gold focus:ring-2 focus:ring-gold/25";

  return (
    <div className="min-h-screen bg-parchment lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel: full height on computers, a header on phones */}
      <aside className="relative overflow-hidden bg-navy px-6 py-10 text-parchment sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(201,162,39,0.18), transparent 45%), radial-gradient(circle at 85% 85%, rgba(10,74,122,0.9), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
          <StakeLogo size={96} priority />
          <div className="mt-5 flex items-center gap-2">
            <IrmsMark size={30} />
            <h1 className="font-display text-3xl tracking-wide">IRMS</h1>
          </div>
          <p className="mt-1 text-sm text-parchment/70">Institute of Religion Management System</p>
          <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-gold">Abeokuta Oke-Ata Stake</p>
        </div>

        <ul className="relative mt-10 hidden space-y-4 lg:block">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-parchment/85">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-white/5 text-gold">
                <Icon size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <p className="relative mt-10 hidden text-xs text-parchment/40 lg:block">
          &ldquo;Seek learning, even by study and also by faith.&rdquo; D&amp;C 88:118
        </p>
      </aside>

      {/* Sign-in form */}
      <main className="flex items-start justify-center px-4 pb-12 pt-0 sm:px-6 lg:items-center lg:py-12">
        <div className="-mt-6 w-full max-w-sm lg:mt-0">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-navy/10 border-t-4 border-t-gold bg-white p-6 shadow-xl sm:p-8"
            noValidate
          >
            <h2 className="font-display text-2xl text-navy">Welcome back</h2>
            <p className="mb-6 mt-1 text-sm text-navy/60">Sign in with the email your coordinator registered.</p>

            {error && (
              <div role="alert" className="mb-5 flex gap-2 rounded-md border border-clay/30 bg-clay/10 px-3 py-2.5 text-sm text-clay">
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-navy/80">Email</label>
            <div className="relative mb-4">
              <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                required
              />
            </div>

            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-navy/80">Password</label>
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
              <input
                id="password"
                type={show ? "text" : "password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={watchCaps}
                onKeyDown={watchCaps}
                className={`${field} pr-11`}
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-navy/50 hover:text-navy"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {capsLock && <p className="mt-1.5 text-xs font-medium text-clay">Caps Lock is on.</p>}

            <div className="mb-6 mt-4 flex items-center justify-between gap-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-navy/70">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 accent-navy"
                />
                Remember my email
              </label>
              <button type="button" onClick={() => setShowHelp(!showHelp)} className="font-medium text-navy hover:text-gold">
                Forgot password?
              </button>
            </div>

            {showHelp && (
              <p className="-mt-3 mb-5 rounded-md bg-parchment px-3 py-2.5 text-xs leading-relaxed text-navy/75">
                Ask your institute coordinator or teacher to reset it. They&apos;ll give you a new password, and you can
                change it afterwards under <b>My Account</b>.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || checkingSession || !email.trim() || !password}
              className="group flex w-full items-center justify-center gap-2 rounded-md bg-navy py-3 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-navy/45">
            For students, teachers and leaders of the Institute of Religion, Abeokuta Oke-Ata Stake.
          </p>
        </div>
      </main>
    </div>
  );
}
