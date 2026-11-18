"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarCheck, GraduationCap, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { AnimatedBackground, Meter, ProgressRing } from "@/app/components/Motion";
import { Reveal } from "@/app/components/Alive";
import ErrorScreen from "@/app/components/ErrorScreen";

type ClassStanding = {
  enrollmentId: string;
  classId: string;
  name: string;
  creditType: "CORE" | "ELECTIVE";
  enrollment: "ACTIVE" | "COMPLETED" | "DROPPED";
  course: "upcoming" | "running" | "finished";
  totalClasses: number | null;
  classesSoFar: number | null;
  attended: number;
  heldDays: number;
  percent: number | null;
  atRisk: boolean;
};
type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  ward: string | null;
  stake: string | null;
  occupation: string | null;
  school: string | null;
  active: boolean;
  joined: string;
  lastLoginAt: string | null;
  standing: {
    core: { done: number; required: number };
    elective: { done: number; required: number };
    status: string;
    stillNeeded: string;
    classes: ClassStanding[];
  } | null;
  attendance: { id: string; date: string; status: string; className: string }[];
  events: { title: string; date: string; status: string }[];
  canEditStake: boolean;
};

const PILL: Record<string, string> = {
  PRESENT: "bg-sage/15 text-sage",
  LATE: "bg-gold/25 text-navy",
  EXCUSED: "bg-navy/10 text-navy/70",
  ABSENT: "bg-clay/15 text-clay",
};

export default function StudentProfilePage() {
  const { id } = useParams() as { id: string };
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", ward: "", stake: "" });
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/students/${id}`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setP(body);
    else setError(body.error ?? "This student couldn't be opened");
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const res = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setSaveError((await res.json().catch(() => ({}))).error ?? "Couldn't save");
      return;
    }
    setEditing(false);
    load();
  }

  if (error) return <ErrorScreen full={false} code="403" title="Can't open this profile" message={error} />;
  if (!p) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment">
        <User className="irms-bob text-navy/25" size={48} />
      </div>
    );
  }

  const s = p.standing;
  const card = "rounded-2xl border border-navy/10 bg-white p-5 shadow-sm";
  const field = "w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold";
  const presentCount = p.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;

  return (
    <div className="min-h-screen bg-parchment pb-12">
      <section className="irms-gradient-pan relative overflow-hidden bg-gradient-to-br from-navy via-navy-light to-navy px-4 pb-16 pt-6 text-parchment sm:px-8">
        <AnimatedBackground tone="dark" fixed={false} />
        <div className="relative z-10 mx-auto max-w-5xl">
          <Link href="/dashboard/students" className="mb-4 inline-flex items-center gap-1 text-sm text-parchment/70 hover:text-parchment">
            <ArrowLeft size={16} /> Students
          </Link>
          <div className="flex flex-wrap items-center gap-5">
            <span className="irms-pop flex h-20 w-20 items-center justify-center rounded-full bg-gold font-display text-4xl text-navy shadow-xl ring-4 ring-white/20">
              {p.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <h1 className="irms-enter-left font-display text-3xl">{p.name}</h1>
              <p className="irms-enter-left mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-parchment/75" style={{ animationDelay: "0.1s" }}>
                <span className="flex items-center gap-1.5"><Mail size={14} /> {p.email}</span>
                {p.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {p.phone}</span>}
                {(p.ward || p.stake) && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} /> {[p.ward && `${p.ward} Ward`, p.stake && `${p.stake} Stake`].filter(Boolean).join(" · ")}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-parchment/50">
                Joined {new Date(p.joined).toLocaleDateString()} · {p.lastLoginAt ? `last signed in ${new Date(p.lastLoginAt).toLocaleDateString()}` : "hasn't signed in yet"}
                {!p.active && " · inactive"}
              </p>
            </div>
            <button
              onClick={() => {
                setEditing(!editing);
                setForm({ name: p.name, phone: p.phone ?? "", ward: p.ward ?? "", stake: p.stake ?? "" });
              }}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur hover:bg-white/20"
            >
              <Pencil size={14} /> Edit details
            </button>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-8 max-w-5xl space-y-6 px-4 sm:px-8">
        {editing && (
          <form onSubmit={save} className="irms-enter-down grid gap-3 rounded-2xl border-t-4 border-gold bg-white p-5 shadow-lg sm:grid-cols-2">
            {saveError && <p className="rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay sm:col-span-2">{saveError}</p>}
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="Full name" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} placeholder="Phone" />
            <input value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} className={field} placeholder="Ward" />
            <input value={form.stake} onChange={(e) => setForm({ ...form, stake: e.target.value })} className={field} placeholder="Stake" disabled={!p.canEditStake} title={p.canEditStake ? "" : "Only leaders without a stake limit can move students between stakes"} />
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded bg-navy px-4 py-2 text-sm font-medium text-parchment hover:bg-gold hover:text-navy">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded px-4 py-2 text-sm text-navy/60 hover:text-navy">Cancel</button>
            </div>
          </form>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Reveal from="left">
            <div className={card}>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-navy">
                <GraduationCap size={20} className="text-gold" /> Graduation
              </h2>
              {s ? (
                <>
                  <div className="flex justify-around">
                    <div className="text-center">
                      <ProgressRing percent={(s.core.done / Math.max(1, s.core.required)) * 100} size={96} label="Core" color="#003057" />
                      <p className="mt-1 text-xs text-navy/55">{s.core.done} of {s.core.required}</p>
                    </div>
                    <div className="text-center">
                      <ProgressRing percent={(s.elective.done / Math.max(1, s.elective.required)) * 100} size={96} label="Elective" color="#C9A227" />
                      <p className="mt-1 text-xs text-navy/55">{s.elective.done} of {s.elective.required}</p>
                    </div>
                  </div>
                  <p className="mt-4 rounded-lg bg-parchment px-3 py-2 text-center text-sm text-navy/75">{s.stillNeeded}</p>
                  <Link href="/dashboard/graduation" className="mt-3 block text-center text-sm font-medium text-navy hover:text-gold">
                    Open Graduation →
                  </Link>
                </>
              ) : (
                <p className="text-sm text-navy/50">No graduation record yet.</p>
              )}
            </div>
          </Reveal>

          <Reveal from="right" delay={0.05}>
            <div className={card}>
              <h2 className="mb-4 font-display text-lg text-navy">Classes</h2>
              {!s || s.classes.length === 0 ? (
                <p className="text-sm text-navy/50">Not enrolled in any classes.</p>
              ) : (
                <ul className="space-y-3">
                  {s.classes.map((c) => (
                    <li key={c.enrollmentId}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <Link href={`/dashboard/class/${c.classId}`} className="font-medium text-navy hover:text-gold">
                          {c.name}
                        </Link>
                        <span className="text-xs text-navy/55">
                          {c.enrollment === "COMPLETED" ? "✓ Completed" : c.enrollment === "DROPPED" ? "Dropped" : c.totalClasses ? `Class ${c.classesSoFar} of ${c.totalClasses}` : c.course}
                          {c.percent !== null && ` · ${c.percent}%`}
                          {c.atRisk && <b className="ml-1 text-clay">At risk</b>}
                        </span>
                      </div>
                      <Meter percent={c.percent ?? 0} color={c.percent === null ? "bg-navy/20" : c.percent >= 75 ? "bg-sage" : c.percent >= 50 ? "bg-gold" : "bg-clay"} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className={card}>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
              <CalendarCheck size={20} className="text-gold" /> Recent attendance
              <span className="ml-auto text-xs font-normal text-navy/50">{presentCount} of the last {p.attendance.length} records present or late</span>
            </h2>
            {p.attendance.length === 0 ? (
              <p className="text-sm text-navy/50">No attendance recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {p.attendance.map((a) => (
                  <span key={a.id} title={`${a.className} · ${new Date(a.date).toLocaleDateString()}`} className={`rounded-lg px-2.5 py-1 text-xs ${PILL[a.status] ?? ""}`}>
                    {new Date(a.date).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "Africa/Lagos" })} · {a.className}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
