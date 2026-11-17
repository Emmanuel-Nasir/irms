"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, Lock, Mail, ShieldCheck } from "lucide-react";
import { IrmsMark, StakeLogo } from "@/app/components/Brand";

const REMEMBER_KEY = "irms:email";

// The line under the title rotates through what IRMS does
const TAGLINES = [
  "Check in to class with one quick scan",
  "See your classes and weekly schedule",
  "Follow your progress towards graduation",
  "Stay up to date with stake announcements",
];

// Shapes that float up the background. Fixed values (not random) so the page
// looks the same every time and the server and browser agree.
const PARTICLES = [
  { left: 4, size: 10, dur: 19, delay: 0, shape: "dot", o: 0.45 },
  { left: 11, size: 18, dur: 26, delay: 6, shape: "ring", o: 0.35 },
  { left: 18, size: 8, dur: 17, delay: 11, shape: "diamond", o: 0.5 },
  { left: 26, size: 14, dur: 23, delay: 3, shape: "plus", o: 0.3 },
  { left: 33, size: 6, dur: 15, delay: 8, shape: "dot", o: 0.55 },
  { left: 41, size: 22, dur: 30, delay: 14, shape: "ring", o: 0.25 },
  { left: 48, size: 9, dur: 21, delay: 1, shape: "diamond", o: 0.45 },
  { left: 56, size: 12, dur: 18, delay: 9, shape: "dot", o: 0.35 },
  { left: 63, size: 16, dur: 27, delay: 4, shape: "plus", o: 0.3 },
  { left: 70, size: 7, dur: 16, delay: 12, shape: "dot", o: 0.5 },
  { left: 77, size: 20, dur: 29, delay: 2, shape: "ring", o: 0.3 },
  { left: 84, size: 10, dur: 20, delay: 7, shape: "diamond", o: 0.45 },
  { left: 90, size: 13, dur: 24, delay: 15, shape: "plus", o: 0.3 },
  { left: 96, size: 8, dur: 18, delay: 5, shape: "dot", o: 0.5 },
] as const;

function Particle({ p }: { p: (typeof PARTICLES)[number] }) {
  const style = {
    left: `${p.left}%`,
    width: p.size,
    height: p.size,
    animationDuration: `${p.dur}s`,
    animationDelay: `-${p.delay}s`,
    "--irms-o": p.o,
    "--irms-spin": p.shape === "diamond" || p.shape === "plus" ? "320deg" : "0deg",
  } as CSSProperties;

  if (p.shape === "ring") return <span className="irms-particle rounded-full border-2 border-gold/70" style={style} />;
  if (p.shape === "diamond") return <span className="irms-particle rotate-45 bg-gold/80" style={style} />;
  if (p.shape === "plus")
    return (
      <span className="irms-particle text-parchment/70" style={style}>
        <svg viewBox="0 0 10 10" width="100%" height="100%" aria-hidden="true">
          <path d="M5 0v10M0 5h10" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
    );
  return <span className="irms-particle rounded-full bg-parchment/80" style={style} />;
}

function greetingNow() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Welcome");
  const [tagline, setTagline] = useState(0);
  // Two-step sign-in: after the password, ask for the code from the authenticator app
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  useEffect(() => {
    setGreeting(greetingNow());

    // Already signed in on this device? Go straight on.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => me && router.replace(nextPath()))
      .catch(() => {});

    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "idle") setError("You were signed out after a while with no activity, to keep your account safe. Please sign in again.");

    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) setEmail(saved);
    } catch {
      // Storage can be unavailable (private browsing); remembering is only a convenience
    }

    const t = setInterval(() => setTagline((i) => (i + 1) % TAGLINES.length), 3200);
    return () => clearInterval(t);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
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
        setShakeKey((k) => k + 1);
        setPassword("");
        setLoading(false);
        return;
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, cleanEmail.toLowerCase());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {}
      if (data.twoFactor) {
        setChallenge(data.challenge);
        setPassword("");
        setLoading(false);
        return;
      }
      setWelcome(data.user?.name?.split(" ")[0] ?? "");
      setTimeout(() => router.replace(nextPath()), 1100);
    } catch {
      setError("Couldn't reach IRMS. Check your internet connection and try again.");
      setShakeKey((k) => k + 1);
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "RESTART") setChallenge(null);
        setError(data.error ?? "Something went wrong. Please try again.");
        setShakeKey((k) => k + 1);
        setCode("");
        setLoading(false);
        return;
      }
      if (typeof data.recoveryCodesLeft === "number" && data.recoveryCodesLeft <= 2) {
        window.alert(`You have ${data.recoveryCodesLeft} recovery code(s) left. Make new ones under My Account.`);
      }
      setWelcome(data.user?.name?.split(" ")[0] ?? "");
      setTimeout(() => router.replace(nextPath()), 1100);
    } catch {
      setError("Couldn't reach IRMS. Check your internet connection and try again.");
      setLoading(false);
    }
  }

  function watchCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  }

  const field =
    "w-full rounded-lg border border-navy/15 bg-white/90 py-3 pl-11 pr-3 text-navy outline-none transition-all placeholder:text-navy/30 focus:border-gold focus:bg-white focus:shadow-[0_0_0_4px_rgba(201,162,39,0.18)]";
  const iconLeft =
    "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/35 transition-colors peer-focus:text-gold";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-4 py-10">
      {/* Moving background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="irms-orb irms-orb-a -left-32 -top-32 h-[28rem] w-[28rem] bg-gold/25" />
        <div className="irms-orb irms-orb-b -bottom-40 -right-24 h-[32rem] w-[32rem] bg-navy-light" />
        <div className="irms-orb irms-orb-c left-1/3 top-1/2 h-80 w-80 bg-sage/25" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(rgba(250,249,246,0.9) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {PARTICLES.map((p, i) => (
          <Particle key={i} p={p} />
        ))}
      </div>

      {/* Logo and title */}
      <div className="irms-enter-down relative mb-7 flex flex-col items-center text-center">
        <div className="irms-float relative">
          <span className="irms-pulse-ring absolute inset-0 rounded-full border-2 border-gold/60" />
          <span
            className="irms-spin-slow absolute -inset-3 rounded-full border border-dashed border-gold/40"
            aria-hidden="true"
          />
          <div className="relative rounded-full bg-parchment/10 p-1.5 shadow-[0_0_40px_rgba(201,162,39,0.35)] ring-1 ring-gold/40">
            <StakeLogo size={92} priority />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <IrmsMark size={30} />
          <h1 className="font-display text-4xl tracking-[0.12em] text-parchment">IRMS</h1>
        </div>
        <p className="mt-1 text-sm text-parchment/70">Institute of Religion Management System</p>
        <div className="mt-3 h-5 overflow-hidden text-sm font-medium text-gold" aria-live="polite">
          <span key={tagline} className="irms-ticker block">
            {TAGLINES[tagline]}
          </span>
        </div>
      </div>

      {/* Sign-in card */}
      <div className="irms-enter-up relative w-full max-w-sm" style={{ animationDelay: "0.15s" }}>
        <div key={shakeKey} className={shakeKey ? "irms-shake" : ""}>
          <div className="overflow-hidden rounded-2xl bg-parchment shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)]">
            <div className="irms-shimmer-bar h-1.5" />

            {welcome !== null ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="irms-pop flex h-16 w-16 items-center justify-center rounded-full bg-sage text-white shadow-lg">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true">
                    <path className="irms-draw" d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="irms-enter-up mt-5 font-display text-2xl text-navy" style={{ animationDelay: "0.2s" }}>
                  Welcome{welcome ? `, ${welcome}` : ""}!
                </p>
                <p className="irms-enter-up mt-1 text-sm text-navy/60" style={{ animationDelay: "0.3s" }}>
                  Opening your dashboard...
                </p>
              </div>
            ) : challenge ? (
              <form onSubmit={submitCode} className="p-6 sm:p-8" noValidate>
                <div className="irms-enter-left">
                  <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-navy text-gold shadow-lg">
                    <ShieldCheck size={24} />
                  </span>
                  <h2 className="font-display text-2xl text-navy">Two-step sign-in</h2>
                  <p className="mb-6 mt-1 text-sm text-navy/60">
                    {useRecovery
                      ? "Type one of the recovery codes you saved when you set this up."
                      : "Open your authenticator app and type the 6-digit code for IRMS."}
                  </p>
                </div>

                {error && (
                  <div role="alert" className="irms-enter-down mb-5 flex gap-2 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2.5 text-sm text-clay">
                    <CircleAlert size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="irms-enter-left relative mb-5" style={{ animationDelay: "0.1s" }}>
                  <input
                    autoFocus
                    inputMode={useRecovery ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    maxLength={useRecovery ? 11 : 6}
                    placeholder={useRecovery ? "XXXXX-XXXXX" : "123456"}
                    value={code}
                    onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, ""))}
                    className={`peer ${field} text-center font-mono text-2xl tracking-[0.4em]`}
                  />
                  <KeyRound size={18} className={iconLeft} />
                </div>

                <button
                  type="submit"
                  disabled={loading || (useRecovery ? code.trim().length < 10 : code.length !== 6)}
                  className="irms-shine group flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-3 font-medium text-parchment shadow-lg shadow-navy/30 transition-all hover:-translate-y-0.5 hover:bg-gold hover:text-navy disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-navy disabled:hover:text-parchment"
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" /> Checking...
                    </>
                  ) : (
                    <>
                      Verify <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>

                <div className="mt-5 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecovery(!useRecovery);
                      setCode("");
                      setError("");
                    }}
                    className="font-medium text-navy hover:text-gold"
                  >
                    {useRecovery ? "Use the app code" : "Lost your phone?"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChallenge(null);
                      setCode("");
                      setError("");
                    }}
                    className="text-navy/60 hover:text-navy"
                  >
                    Back
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 sm:p-8" noValidate>
                <div className="irms-enter-left" style={{ animationDelay: "0.3s" }}>
                  <h2 className="font-display text-2xl text-navy">{greeting}</h2>
                  <p className="mb-6 mt-1 text-sm text-navy/60">Sign in to continue to IRMS.</p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="irms-enter-down mb-5 flex gap-2 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2.5 text-sm text-clay"
                  >
                    <CircleAlert size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="irms-enter-left" style={{ animationDelay: "0.4s" }}>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-navy/80">Email</label>
                  <div className="relative mb-4">
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                      placeholder="you@example.com"
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`peer ${field}`}
                      required
                    />
                    <Mail size={18} className={iconLeft} />
                  </div>
                </div>

                <div className="irms-enter-left" style={{ animationDelay: "0.5s" }}>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-navy/80">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={show ? "text" : "password"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="current-password"
                      placeholder="Your password"
                      maxLength={200}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={watchCaps}
                      onKeyDown={watchCaps}
                      className={`peer ${field} pr-11`}
                      required
                    />
                    <Lock size={18} className={iconLeft} />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center px-3.5 text-navy/45 transition-colors hover:text-navy"
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {capsLock && <p className="irms-enter-down mt-1.5 text-xs font-medium text-clay">Caps Lock is on.</p>}
                </div>

                <div
                  className="irms-enter-left mb-6 mt-4 flex items-center justify-between gap-3 text-sm"
                  style={{ animationDelay: "0.6s" }}
                >
                  <label className="flex cursor-pointer items-center gap-2 text-navy/70">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 accent-navy"
                    />
                    Remember my email
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="font-medium text-navy underline-offset-4 transition-colors hover:text-gold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {showHelp && (
                  <p className="irms-enter-down -mt-3 mb-5 rounded-lg bg-navy/5 px-3 py-2.5 text-xs leading-relaxed text-navy/75">
                    Ask your institute coordinator or teacher to reset it. They&apos;ll give you a new password, and you
                    can change it afterwards under <b>My Account</b>.
                  </p>
                )}

                <div className="irms-enter-up" style={{ animationDelay: "0.7s" }}>
                  <button
                    type="submit"
                    disabled={loading || !email.trim() || !password}
                    className="irms-shine group flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-3 font-medium text-parchment shadow-lg shadow-navy/30 transition-all hover:-translate-y-0.5 hover:bg-gold hover:text-navy hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-navy disabled:hover:text-parchment"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle size={18} className="animate-spin" /> Signing in...
                      </>
                    ) : (
                      <>
                        Sign in <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-navy/45">
                  <ShieldCheck size={14} /> Secure sign-in
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <p className="irms-enter-up relative mt-8 text-xs uppercase tracking-[0.25em] text-parchment/50" style={{ animationDelay: "0.9s" }}>
        Abeokuta Oke-Ata Stake
      </p>
    </div>
  );
}
