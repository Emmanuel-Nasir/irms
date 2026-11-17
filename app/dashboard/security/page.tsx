"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, CheckCircle2, DatabaseBackup, Globe, LockOpen, LogOut, MapPin, ShieldAlert,
  ShieldCheck, UserX,
} from "lucide-react";
import { TwoFactorRequired, useConfirmPassword } from "@/app/components/ConfirmPassword";
import { CountUp, ProgressRing } from "@/app/components/Motion";

type Person = { id: string; name: string; email: string; role: string };
type Overview = {
  you: { twoFactor: boolean };
  usersByRole: Record<string, number>;
  locked: (Person & { lockedUntil: string })[];
  leadersWithoutStake: Person[];
  adminsWithoutTwoFactor: Person[];
  signIns24h: { failed: number; succeeded: number };
  failedByIp: { ip: string; count: number }[];
  recentSignIns: { id: string; actorName: string; summary: string; ip: string | null; createdAt: string }[];
  auditCount: number;
};

const LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  AREA_ADMIN: "Area Admin",
  STAKE_ADMIN: "Stake Admin",
  COORDINATOR: "Coordinator",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

export default function SecurityPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [locked2fa, setLocked2fa] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirmPassword();

  async function load() {
    const res = await fetch("/api/security");
    const body = await res.json().catch(() => ({}));
    if (res.ok) setData(body);
    else if (body.code === "TWO_FACTOR_REQUIRED") setLocked2fa(true);
    else setError(body.error ?? "Couldn't load");
  }
  useEffect(() => {
    load();
  }, []);

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 3500);
  }

  async function unlock(p: Person) {
    const res = await fetch(`/api/users/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlock: true }),
    });
    if (res.ok) {
      flash(`${p.name} unlocked.`);
      load();
    }
  }

  async function signOutEveryone() {
    const pw = await ask("Sign out everyone except you? They'll all need to sign in again.");
    if (!pw) return;
    setBusy(true);
    const res = await fetch("/api/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign-out-everyone", confirmPassword: pw }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Something went wrong");
    else flash(`${body.count} accounts signed out.`);
  }

  async function backup() {
    const pw = await ask("Download a full backup of IRMS records?", false);
    if (!pw) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/security/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmPassword: pw }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Backup failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `irms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Backup downloaded. Keep the file somewhere safe.");
  }

  if (locked2fa) {
    return (
      <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
        <h1 className="mb-6 font-display text-2xl text-navy">Security Centre</h1>
        <div className="max-w-xl">
          <TwoFactorRequired />
        </div>
      </div>
    );
  }

  // A simple score: each open issue takes points off
  const issues = data
    ? [
        data.adminsWithoutTwoFactor.length > 0,
        data.leadersWithoutStake.length > 0,
        data.locked.length > 0,
        data.signIns24h.failed >= 20,
      ].filter(Boolean).length
    : 0;
  const score = Math.max(25, 100 - issues * 20);
  const card = "rounded-2xl border border-navy/10 bg-white/90 p-5 shadow-sm";

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
      {dialog}
      {notice && (
        <div className="irms-toast fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-2xl">
          ✓ {notice}
        </div>
      )}
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 font-display text-2xl text-navy">
            <ShieldCheck className="text-gold" /> Security Centre
          </h1>
          <p className="text-sm text-navy/60">What needs attention, and the tools to keep IRMS safe.</p>
        </div>
        {error && <p className="mb-4 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

        {!data ? (
          <p className="py-10 text-center text-sm text-navy/50">Loading...</p>
        ) : (
          <>
            {/* Score and headline numbers */}
            <section className="irms-gradient-pan mb-6 grid gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-light to-navy p-6 text-parchment shadow-xl sm:grid-cols-[auto_1fr]">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-parchment p-1">
                  <ProgressRing percent={score} size={104} label="Health" color={score >= 80 ? "#5B8266" : score >= 60 ? "#C9A227" : "#B4544A"} />
                </div>
                <div>
                  <p className="font-display text-xl">{issues === 0 ? "All clear" : `${issues} thing${issues !== 1 ? "s" : ""} to look at`}</p>
                  <p className="text-sm text-parchment/70">Based on the checks below.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Sign-ins (24 h)", value: data.signIns24h.succeeded },
                  { label: "Failed (24 h)", value: data.signIns24h.failed },
                  { label: "Locked now", value: data.locked.length },
                  { label: "Log entries", value: data.auditCount },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                    <p className="font-display text-2xl">
                      <CountUp value={s.value} />
                    </p>
                    <p className="text-xs text-parchment/70">{s.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className={card}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                  <ShieldAlert size={20} className="text-gold" /> Admins without two-step sign-in
                </h2>
                {data.adminsWithoutTwoFactor.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-sage">
                    <CheckCircle2 size={16} /> Every admin has it on.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-navy/60">
                      Ask these admins to switch it on under My Account. Super admin tools stay locked for super admins
                      without it.
                    </p>
                    <ul className="space-y-1.5">
                      {data.adminsWithoutTwoFactor.map((p) => (
                        <li key={p.id} className="flex justify-between gap-3 rounded-lg bg-parchment px-3 py-2 text-sm">
                          <span className="truncate text-navy">{p.name}</span>
                          <span className="shrink-0 text-xs text-navy/50">{LABEL[p.role]}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className={card}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                  <MapPin size={20} className="text-gold" /> Leaders without a stake
                </h2>
                {data.leadersWithoutStake.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-sage">
                    <CheckCircle2 size={16} /> Every stake admin and coordinator is limited to their stake.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-navy/60">
                      Until a stake is set, they can see students from every stake. Set it on the{" "}
                      <Link href="/dashboard/users" className="font-medium text-navy underline">
                        All Users
                      </Link>{" "}
                      page (Stake button).
                    </p>
                    <ul className="space-y-1.5">
                      {data.leadersWithoutStake.map((p) => (
                        <li key={p.id} className="flex justify-between gap-3 rounded-lg bg-parchment px-3 py-2 text-sm">
                          <span className="truncate text-navy">{p.name}</span>
                          <span className="shrink-0 text-xs text-navy/50">{LABEL[p.role]}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className={card}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                  <UserX size={20} className="text-gold" /> Locked accounts
                </h2>
                {data.locked.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-sage">
                    <CheckCircle2 size={16} /> No accounts are locked.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.locked.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-parchment px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate text-navy">{p.name}</span>
                          <span className="text-xs text-navy/50">
                            until {new Date(p.lockedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </span>
                        <button onClick={() => unlock(p)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy hover:bg-white">
                          <LockOpen size={13} /> Unlock
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={card}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                  <Globe size={20} className="text-gold" /> Failed sign-ins by network (24 h)
                </h2>
                {data.failedByIp.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-sage">
                    <CheckCircle2 size={16} /> No failed sign-ins.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.failedByIp.map((f) => (
                      <li key={f.ip} className="flex items-center justify-between gap-3 rounded-lg bg-parchment px-3 py-2 text-sm">
                        <span className="font-mono text-navy">{f.ip}</span>
                        <span className={`text-xs font-semibold ${f.count >= 10 ? "text-clay" : "text-navy/60"}`}>
                          {f.count >= 10 && <AlertTriangle size={12} className="mr-1 inline" />}
                          {f.count} failed
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={`${card} lg:col-span-2`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-lg text-navy">
                    <Activity size={20} className="text-gold" /> Recent sign-ins
                  </h2>
                  <Link href="/dashboard/activity" className="text-sm font-medium text-navy hover:text-gold">
                    Full activity log →
                  </Link>
                </div>
                {data.recentSignIns.length === 0 ? (
                  <p className="text-sm text-navy/50">No sign-ins recorded this week yet.</p>
                ) : (
                  <ul className="divide-y divide-navy/5">
                    {data.recentSignIns.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="text-navy">{s.summary}</span>
                        <span className="text-xs text-navy/50">
                          {new Date(s.createdAt).toLocaleString()} {s.ip && `· ${s.ip}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={card}>
                <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-navy">
                  <DatabaseBackup size={20} className="text-gold" /> Backup
                </h2>
                <p className="mb-4 text-sm text-navy/60">
                  Download every record as one file. Passwords and two-step secrets are left out. It still holds
                  members&apos; personal details, so keep it private. Your database provider&apos;s automatic backups are
                  the main safety net; this is an extra copy you control.
                </p>
                <button
                  onClick={backup}
                  disabled={busy}
                  className="irms-shine rounded-lg bg-navy px-4 py-2 text-sm font-medium text-parchment hover:bg-gold hover:text-navy disabled:opacity-50"
                >
                  Download backup
                </button>
              </section>

              <section className={card}>
                <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-navy">
                  <LogOut size={20} className="text-clay" /> Emergency sign-out
                </h2>
                <p className="mb-4 text-sm text-navy/60">
                  If you think an account or device has been misused, sign out everyone except you. Everyone has to sign
                  in again.
                </p>
                <button
                  onClick={signOutEveryone}
                  disabled={busy}
                  className="rounded-lg bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay/90 disabled:opacity-50"
                >
                  Sign out everyone
                </button>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
