"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ShieldAlert, ShieldCheck } from "lucide-react";

type Status = { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number; required: boolean };

export default function TwoFactorCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"idle" | "disable" | "new-codes">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/auth/two-factor");
    if (res.ok) setStatus(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function call(body: Record<string, unknown>) {
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/two-factor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return null;
    }
    return data;
  }

  async function start() {
    const data = await call({ action: "start" });
    if (data) setSetup(data);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const data = await call({ action: "confirm", code });
    if (!data) return;
    setCodes(data.recoveryCodes);
    setSetup(null);
    setCode("");
    load();
  }

  async function act(e: React.FormEvent) {
    e.preventDefault();
    const data = await call({ action: mode, code, password });
    if (!data) return;
    if (data.recoveryCodes) setCodes(data.recoveryCodes);
    setMode("idle");
    setCode("");
    setPassword("");
    load();
  }

  function downloadCodes() {
    if (!codes) return;
    const text = `IRMS recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "irms-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const input = "w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold";
  const button =
    "rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50";
  const ghost = "rounded border border-navy/20 px-3 py-1.5 text-sm text-navy transition-colors hover:border-gold hover:text-gold";

  if (!status) return null;

  return (
    <section className="mt-6 max-w-4xl rounded border-t-4 border-gold bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg text-navy">
          {status.enabled ? <ShieldCheck className="text-sage" size={22} /> : <ShieldAlert className="text-clay" size={22} />}
          Two-step sign-in
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            status.enabled ? "bg-sage/15 text-sage" : "bg-clay/10 text-clay"
          }`}
        >
          {status.enabled ? "On" : "Off"}
        </span>
      </div>

      {error && <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

      {codes && (
        <div className="mb-5 rounded-lg border-2 border-gold bg-gold/10 p-4">
          <p className="font-medium text-navy">Save these recovery codes now</p>
          <p className="mb-3 text-sm text-navy/70">
            If you lose your phone, each code lets you sign in once. They won&apos;t be shown again.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
            {codes.map((c) => (
              <span key={c} className="rounded bg-white px-2 py-1 text-center text-navy">
                {c}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadCodes} className={ghost}>
              <Download size={14} className="mr-1 inline" /> Download
            </button>
            <button onClick={() => navigator.clipboard.writeText(codes.join("\n"))} className={ghost}>
              <Copy size={14} className="mr-1 inline" /> Copy
            </button>
            <button onClick={() => setCodes(null)} className={ghost}>
              I&apos;ve saved them
            </button>
          </div>
        </div>
      )}

      {!status.enabled && !setup && (
        <>
          <p className="mb-4 text-sm text-navy/70">
            Besides your password, sign-in will also ask for a 6-digit code from an app on your phone (Google
            Authenticator, Microsoft Authenticator or similar). Someone who learns your password still can&apos;t get in.
            {status.required && (
              <b className="mt-2 block text-clay">Super admin tools stay locked until you switch this on.</b>
            )}
          </p>
          <button onClick={start} disabled={busy} className={button}>
            {busy ? "Starting..." : "Set up two-step sign-in"}
          </button>
        </>
      )}

      {setup && (
        <form onSubmit={confirm} className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center">
            <div className="rounded-lg bg-white p-3 shadow-inner ring-1 ring-navy/10">
              <QRCodeSVG value={setup.uri} size={180} />
            </div>
            <p className="mt-2 max-w-[200px] break-all text-center font-mono text-[11px] text-navy/60">{setup.secret}</p>
          </div>
          <div>
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-navy/80">
              <li>Install Google Authenticator or Microsoft Authenticator on your phone.</li>
              <li>In the app, add an account and scan this QR code (or type the key under it).</li>
              <li>Type the 6-digit code the app shows for IRMS.</li>
            </ol>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${input} mb-3 max-w-[200px] text-center font-mono text-xl tracking-[0.3em]`}
            />
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.length !== 6} className={button}>
                {busy ? "Checking..." : "Switch on"}
              </button>
              <button type="button" onClick={() => setSetup(null)} className={ghost}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {status.enabled && (
        <>
          <p className="mb-4 text-sm text-navy/70">
            On since {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString() : "earlier"}.{" "}
            {status.recoveryCodesLeft} recovery code{status.recoveryCodesLeft !== 1 ? "s" : ""} left.
          </p>
          {mode === "idle" ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMode("new-codes")} className={ghost}>
                Make new recovery codes
              </button>
              <button onClick={() => setMode("disable")} className={`${ghost} hover:border-clay hover:text-clay`}>
                Switch off
              </button>
            </div>
          ) : (
            <form onSubmit={act} className="max-w-sm">
              {mode === "disable" && status.required && (
                <p className="mb-3 text-sm text-clay">Super admin tools will lock again while this is off.</p>
              )}
              {mode === "disable" && (
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${input} mb-3`}
                />
              )}
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="Code from your app"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${input} mb-3 font-mono tracking-widest`}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy || code.length !== 6} className={button}>
                  {mode === "disable" ? "Switch off" : "Make new codes"}
                </button>
                <button type="button" onClick={() => setMode("idle")} className={ghost}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
