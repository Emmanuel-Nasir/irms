"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { IrmsMark, StakeLogo } from "@/app/components/Brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch {
      setError("Couldn't reach the server. Check your internet connection and try again.");
      setLoading(false);
    }
  }

  const field =
    "w-full rounded border border-navy/20 bg-white px-3 py-2 text-navy outline-none transition-colors focus:border-gold";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <StakeLogo size={112} priority />
        <div className="mt-4 flex items-center gap-2">
          <IrmsMark size={32} />
          <h1 className="font-display text-3xl tracking-wide text-parchment">IRMS</h1>
        </div>
        <p className="mt-1 text-sm text-parchment/70">Institute of Religion Management System</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded border-t-4 border-gold bg-parchment p-6 shadow-xl">
        <h2 className="mb-4 font-display text-xl text-navy">Sign in</h2>

        {error && (
          <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-navy/80">Email</label>
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${field} mb-4`}
          required
        />

        <label className="mb-1 block text-sm font-medium text-navy/80">Password</label>
        <div className="relative mb-6">
          <input
            type={show ? "text" : "password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${field} pr-11`}
            required
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-navy/60 hover:text-navy"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-navy py-2.5 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-xs text-parchment/50">Abeokuta Oke-Ata Stake</p>
    </div>
  );
}