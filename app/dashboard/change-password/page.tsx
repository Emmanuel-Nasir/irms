"use client";

import { useEffect, useState } from "react";
import TwoFactorCard from "@/app/components/TwoFactorCard";

type Me = { name: string; email: string; role: string } | null;
type Result = { ok: boolean; text: string } | null;

function Message({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <p
      className={`mb-4 rounded border px-3 py-2 text-sm ${
        result.ok ? "border-sage/30 bg-sage/10 text-sage" : "border-clay/30 bg-clay/10 text-clay"
      }`}
    >
      {result.text}
    </p>
  );
}

export default function MyAccountPage() {
  const [me, setMe] = useState<Me>(null);
  const [mustChange, setMustChange] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailResult, setEmailResult] = useState<Result>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwResult, setPwResult] = useState<Result>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setMe(data);
        setMustChange(!!data?.mustChangePassword || new URLSearchParams(window.location.search).get("first") === "1");
      })
      .catch(() => {});
  }, []);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailResult(null);
    setEmailBusy(true);
    const res = await fetch("/api/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, password: emailPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setEmailBusy(false);
    if (!res.ok) {
      setEmailResult({ ok: false, text: data.error ?? "Something went wrong" });
      return;
    }
    setMe((m) => m && { ...m, email: data.email });
    try {
      localStorage.setItem("irms:email", data.email);
    } catch {}
    setEmailResult({ ok: true, text: `Done. Sign in with ${data.email} from now on.` });
    setNewEmail("");
    setEmailPassword("");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwResult(null);
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwResult({ ok: false, text: "Use at least 8 characters, with at least one letter and one number." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwResult({ ok: false, text: "The new passwords don't match." });
      return;
    }
    setPwBusy(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setPwBusy(false);
    if (!res.ok) {
      setPwResult({ ok: false, text: data.error ?? "Something went wrong" });
      return;
    }
    setPwResult({ ok: true, text: "Password changed. Any other device signed in to your account has been signed out." });
    if (mustChange) {
      setMustChange(false);
      // Their account is now fully open: reload so the menu and pages pick that up
      setTimeout(() => (window.location.href = "/dashboard"), 1200);
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  const card = "rounded border-t-4 border-gold bg-white p-6 shadow-sm";
  const label = "mb-1 block text-sm font-medium text-navy/80";
  const input = "mb-4 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold";
  const button =
    "rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50";

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="mb-1 font-display text-2xl text-navy">My Account</h1>
      <p className="mb-6 text-sm text-navy/60">
        {me ? (
          <>
            Signed in as <b>{me.name}</b> ({me.email})
          </>
        ) : (
          " "
        )}
      </p>

      {mustChange && (
        <div className="irms-glow mb-6 max-w-4xl rounded-2xl border-2 border-gold bg-white p-5 shadow-sm">
          <p className="font-display text-lg text-navy">Welcome! Choose your own password</p>
          <p className="mt-1 text-sm text-navy/70">
            Your account was set up with a temporary password. Choose a new one below to start using IRMS. Use at least 8
            characters with a letter and a number, and avoid your name or anything easy to guess.
          </p>
        </div>
      )}

      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <form onSubmit={changeEmail} className={card}>
          <h2 className="mb-4 font-display text-lg text-navy">Change sign-in email</h2>
          <Message result={emailResult} />
          <label className={label}>New email</label>
          <input
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={input}
            required
          />
          <label className={label}>Current password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            className={input}
            required
          />
          <button type="submit" disabled={emailBusy} className={button}>
            {emailBusy ? "Saving..." : "Change Email"}
          </button>
        </form>

        <form onSubmit={changePassword} className={card}>
          <h2 className="mb-4 font-display text-lg text-navy">Change password</h2>
          <Message result={pwResult} />
          <label className={label}>Current password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={input}
            required
          />
          <label className={label}>New password (8+ characters, a letter and a number)</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={input}
            required
          />
          <label className={label}>Confirm new password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={input}
            required
          />
          <button type="submit" disabled={pwBusy} className={button}>
            {pwBusy ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      <TwoFactorCard />
    </div>
  );
}
