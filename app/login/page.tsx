"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded border-t-4 border-gold bg-parchment p-8 shadow-xl transition-all"
      >
        <h1 className="mb-1 font-display text-3xl text-navy">IRMS</h1>
        <p className="mb-6 text-sm text-navy/60">Institute of Religion Management System</p>

        {error && (
          <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">
            {error}
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-navy/80">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-navy/20 bg-white px-3 py-2 text-navy outline-none transition-colors focus:border-gold"
          required
        />

        <label className="mb-1 block text-sm font-medium text-navy/80">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded border border-navy/20 bg-white px-3 py-2 text-navy outline-none transition-colors focus:border-gold"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-navy py-2.5 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}