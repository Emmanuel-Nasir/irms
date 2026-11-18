"use client";

import { useEffect, useState } from "react";
import { Check, UserRound } from "lucide-react";

type Profile = {
  name: string;
  email: string;
  role: string;
  stake: string | null;
  createdAt: string;
  student: { phone: string | null; ward: string | null; stake: string | null; occupation: string | null; school: string | null } | null;
  teacher: { phone: string | null } | null;
};

/** Your own details: name and phone for everyone, plus ward, occupation and school for students. */
export default function ProfileCard() {
  const [p, setP] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", ward: "", occupation: "", school: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Profile | null) => {
        if (!d) return;
        setP(d);
        setForm({
          name: d.name,
          phone: d.student?.phone ?? d.teacher?.phone ?? "",
          ward: d.student?.ward ?? "",
          occupation: d.student?.occupation ?? "",
          school: d.student?.school ?? "",
        });
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: body.error ?? "Couldn't save" });
  }

  if (!p) return null;
  const hasPhone = !!(p.student || p.teacher);
  const field = "w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold";
  const stake = p.student?.stake ?? p.stake;

  return (
    <form onSubmit={save} className="irms-enter-up mb-6 max-w-4xl rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-light font-display text-xl text-parchment">
          {p.name.charAt(0) || <UserRound size={20} />}
        </span>
        <div>
          <h2 className="font-display text-lg text-navy">My profile</h2>
          <p className="text-xs text-navy/55">
            {p.role.replace(/_/g, " ").toLowerCase()}
            {stake && ` · ${stake} Stake`} · member since {new Date(p.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-navy/60">
          Full name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${field} mt-1`} />
        </label>
        {hasPhone && (
          <label className="text-xs text-navy/60">
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${field} mt-1`} />
          </label>
        )}
        {p.student && (
          <>
            <label className="text-xs text-navy/60">
              Ward
              <input value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-navy/60">
              Occupation
              <input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-navy/60 sm:col-span-2">
              School
              <input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} className={`${field} mt-1`} />
            </label>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={busy} className="rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
          {busy ? "Saving…" : "Save profile"}
        </button>
        {msg && (
          <span className={`flex items-center gap-1 text-sm ${msg.ok ? "text-sage" : "text-clay"}`}>
            {msg.ok && <Check size={16} />} {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
