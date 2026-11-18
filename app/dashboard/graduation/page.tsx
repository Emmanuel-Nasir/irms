"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Award, CheckCircle2, ChevronDown, GraduationCap, RefreshCw, Search, Settings2, Sparkles, Undo2,
} from "lucide-react";
import { CountUp, Meter, ProgressRing } from "@/app/components/Motion";
import { Confetti, Reveal } from "@/app/components/Alive";
import { askConfirm } from "@/app/components/Dialog";

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
  readyToComplete: boolean;
  atRisk: boolean;
};
type Standing = {
  studentId: string;
  name: string;
  email: string;
  stake: string | null;
  ward: string | null;
  core: { done: number; required: number };
  elective: { done: number; required: number };
  graduated: boolean;
  graduationDate: string | null;
  status: "graduated" | "ready" | "on-track" | "at-risk" | "not-started";
  classes: ClassStanding[];
  stillNeeded: string;
};
type Filter = "all" | "ready" | "on-track" | "at-risk" | "graduated" | "not-started";

const STATUS: Record<Standing["status"], { label: string; pill: string }> = {
  graduated: { label: "Graduated", pill: "bg-navy text-gold" },
  ready: { label: "Ready to graduate", pill: "bg-sage text-white" },
  "on-track": { label: "On track", pill: "bg-gold/25 text-navy" },
  "at-risk": { label: "At risk", pill: "bg-clay/15 text-clay" },
  "not-started": { label: "Not started", pill: "bg-navy/10 text-navy/60" },
};

export default function GraduationPage() {
  const [data, setData] = useState<Standing[] | null>(null);
  const [threshold, setThreshold] = useState(75);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [req, setReq] = useState({ core: "2", elective: "2" });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/graduation");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Couldn't load graduation progress");
      return;
    }
    setData(body.standings);
    setThreshold(body.completeAtPercent);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 3000);
  }

  async function call(url: string, method: string, body: unknown) {
    setError("");
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(out.error ?? "Something went wrong");
      return null;
    }
    return out;
  }

  async function completeReady() {
    const n = (data ?? []).reduce((a, s) => a + s.classes.filter((c) => c.readyToComplete).length, 0);
    if (!(await askConfirm(`${n} finished class${n !== 1 ? "es" : ""} will be marked completed. Each one adds a credit.`, { title: "Complete finished classes?", confirmLabel: "Mark completed" }))) return;
    const out = await call("/api/graduation", "POST", { action: "complete-ready" });
    if (out) {
      flash(`${out.updated} class${out.updated !== 1 ? "es" : ""} completed. Credits updated.`);
      load();
    }
  }

  async function setClass(c: ClassStanding, complete: boolean) {
    const out = await call("/api/graduation", "POST", { action: complete ? "complete" : "reopen", enrollmentIds: [c.enrollmentId] });
    if (out) {
      flash(complete ? `${c.name} completed` : `${c.name} reopened`);
      load();
    }
  }

  async function graduate(s: Standing, yes: boolean) {
    if (yes && !(await askConfirm(`${s.name} will be marked as graduated. 🎓`, { title: "Mark as graduated?", confirmLabel: "Graduate" }))) return;
    const out = await call(`/api/graduation/${s.studentId}`, "PATCH", { action: yes ? "graduate" : "ungraduate" });
    if (out) {
      if (yes) setConfetti((n) => n + 1);
      flash(yes ? `Congratulations to ${s.name}! 🎓` : `${s.name} is no longer marked graduated`);
      load();
    }
  }

  async function recalc(s: Standing) {
    if (await call(`/api/graduation/${s.studentId}`, "PATCH", { action: "recalculate" })) {
      flash(`${s.name}'s credits recalculated`);
      load();
    }
  }

  async function saveRequirements(s: Standing) {
    if (
      await call(`/api/graduation/${s.studentId}`, "PATCH", {
        coreCreditsRequired: req.core,
        electiveCreditsRequired: req.elective,
      })
    ) {
      flash("Requirements saved");
      setEditing(null);
      load();
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, ready: 0, "on-track": 0, "at-risk": 0, graduated: 0, "not-started": 0, toComplete: 0 };
    for (const s of data ?? []) {
      c.all++;
      c[s.status]++;
      c.toComplete += s.classes.filter((x) => x.readyToComplete).length;
    }
    return c;
  }, [data]);

  const q = search.trim().toLowerCase();
  const visible = (data ?? []).filter(
    (s) => (filter === "all" || s.status === filter) && (!q || `${s.name} ${s.email} ${s.stake ?? ""} ${s.ward ?? ""}`.toLowerCase().includes(q))
  );

  const card = "rounded-2xl border border-navy/10 bg-white p-5 shadow-sm";

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
      <Confetti fire={confetti} />
      {toast && (
        <div className="irms-toast fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-2xl">
          ✓ {toast}
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl text-navy">
              <GraduationCap className="text-gold" size={30} /> Graduation
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-navy/60">
              Each completed class is one credit (core or elective, set on the Classes page). A finished class can be
              completed when the student came to at least {threshold}% of it.
            </p>
          </div>
          {counts.toComplete > 0 && (
            <button
              onClick={completeReady}
              disabled={busy}
              className="irms-glow irms-shine flex items-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:scale-105 disabled:opacity-50"
            >
              <CheckCircle2 size={18} /> Complete {counts.toComplete} finished class{counts.toComplete !== 1 ? "es" : ""}
            </button>
          )}
        </div>

        {error && <p className="mb-4 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

        {/* Summary tiles double as filters */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["all", "All students", Sparkles],
              ["ready", "Ready to graduate", Award],
              ["on-track", "On track", CheckCircle2],
              ["at-risk", "At risk", AlertTriangle],
              ["graduated", "Graduated", GraduationCap],
              ["not-started", "Not started", Settings2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${
                filter === key ? "border-gold bg-gold/15 ring-2 ring-gold/30" : "border-navy/10 bg-white hover:border-gold"
              }`}
            >
              <Icon size={18} className={key === "at-risk" ? "text-clay" : key === "ready" ? "text-sage" : "text-gold"} />
              <p className="mt-2 font-display text-3xl text-navy">
                <CountUp value={counts[key]} />
              </p>
              <p className="text-xs text-navy/55">{label}</p>
            </button>
          ))}
        </div>

        <div className="relative mb-5">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
          <input
            placeholder="Search students by name, email, stake or ward"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-navy/20 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-gold"
          />
        </div>

        {data === null ? (
          <div className="flex justify-center py-16">
            <GraduationCap className="irms-bob text-navy/25" size={48} />
          </div>
        ) : visible.length === 0 ? (
          <p className={`${card} text-center text-sm text-navy/50`}>No students here.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((s, i) => {
              const corePct = (s.core.done / Math.max(1, s.core.required)) * 100;
              const elecPct = (s.elective.done / Math.max(1, s.elective.required)) * 100;
              const isOpen = open === s.studentId;
              const ready = s.classes.filter((c) => c.readyToComplete);
              return (
                <Reveal key={s.studentId} delay={Math.min(i, 8) * 0.04}>
                  <div className={`${card} ${s.status === "ready" ? "irms-glow-border" : ""}`}>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex shrink-0 gap-2">
                        <ProgressRing percent={corePct} size={70} stroke={7} label="Core" color="#003057" />
                        <ProgressRing percent={elecPct} size={70} stroke={7} label="Elective" color="#C9A227" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-display text-lg text-navy">
                          {s.name}
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS[s.status].pill}`}>
                            {s.status === "graduated" && "🎓 "}
                            {STATUS[s.status].label}
                          </span>
                        </p>
                        <p className="text-xs text-navy/50">
                          {[s.stake, s.ward].filter(Boolean).join(" · ") || s.email}
                        </p>
                        <p className="mt-1 text-sm text-navy/70">
                          Core {s.core.done}/{s.core.required} · Elective {s.elective.done}/{s.elective.required} ·{" "}
                          <span className={s.status === "ready" ? "font-medium text-sage" : ""}>{s.stillNeeded}</span>
                          {s.graduated && s.graduationDate && ` on ${new Date(s.graduationDate).toLocaleDateString()}`}
                        </p>
                        {ready.length > 0 && (
                          <p className="mt-1 text-xs font-medium text-sage">
                            {ready.length} finished class{ready.length !== 1 ? "es" : ""} ready to complete
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {s.status === "ready" && (
                          <button
                            onClick={() => graduate(s, true)}
                            className="irms-shine irms-glow flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-gold hover:scale-105"
                          >
                            <GraduationCap size={16} /> Mark graduated
                          </button>
                        )}
                        <button
                          onClick={() => setOpen(isOpen ? null : s.studentId)}
                          className="flex items-center gap-1 rounded-xl border border-navy/15 px-3 py-2 text-sm text-navy hover:border-gold"
                          aria-expanded={isOpen}
                        >
                          Classes ({s.classes.length})
                          <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="irms-enter-down mt-4 border-t border-navy/5 pt-4">
                        {s.classes.length === 0 ? (
                          <p className="text-sm text-navy/50">Not enrolled in any classes yet.</p>
                        ) : (
                          <ul className="space-y-2">
                            {s.classes.map((c) => (
                              <li key={c.enrollmentId} className="rounded-xl bg-parchment/70 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-navy">
                                      {c.name}
                                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.creditType === "CORE" ? "bg-navy text-parchment" : "bg-gold/30 text-navy"}`}>
                                        {c.creditType === "CORE" ? "Core" : "Elective"}
                                      </span>
                                      {c.enrollment === "COMPLETED" && <span className="text-xs font-semibold text-sage">✓ Completed</span>}
                                      {c.enrollment === "DROPPED" && <span className="text-xs text-navy/40">Dropped</span>}
                                      {c.atRisk && <span className="text-xs font-semibold text-clay">At risk</span>}
                                    </p>
                                    <p className="text-xs text-navy/55">
                                      {c.course === "upcoming"
                                        ? "Not started yet"
                                        : `${c.course === "finished" ? "Finished" : c.totalClasses ? `Class ${c.classesSoFar} of ${c.totalClasses}` : "Running"} · attended ${c.attended} of ${c.heldDays}${c.percent !== null ? ` (${c.percent}%)` : ""}`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {c.enrollment === "ACTIVE" && (
                                      <button
                                        onClick={() => setClass(c, true)}
                                        disabled={busy}
                                        title={c.readyToComplete ? "Finished and attended enough" : "Complete it anyway"}
                                        className={`rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                                          c.readyToComplete ? "bg-sage text-white" : "border border-navy/15 text-navy/70 hover:border-sage hover:text-sage"
                                        }`}
                                      >
                                        Complete
                                      </button>
                                    )}
                                    {c.enrollment === "COMPLETED" && (
                                      <button onClick={() => setClass(c, false)} disabled={busy} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-navy/50 hover:text-navy">
                                        <Undo2 size={13} /> Undo
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {c.percent !== null && c.enrollment !== "DROPPED" && (
                                  <div className="mt-2">
                                    <Meter
                                      percent={c.percent}
                                      color={c.percent >= threshold ? "bg-sage" : c.percent >= 50 ? "bg-gold" : "bg-clay"}
                                    />
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy/5 pt-3">
                          <button onClick={() => recalc(s)} disabled={busy} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-navy/70 hover:bg-parchment hover:text-navy">
                            <RefreshCw size={13} /> Recount credits from completed classes
                          </button>
                          <button
                            onClick={() => {
                              setEditing(editing === s.studentId ? null : s.studentId);
                              setReq({ core: String(s.core.required), elective: String(s.elective.required) });
                            }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-navy/70 hover:bg-parchment hover:text-navy"
                          >
                            <Settings2 size={13} /> Requirements
                          </button>
                          {s.graduated && (
                            <button onClick={() => graduate(s, false)} disabled={busy} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-clay hover:bg-clay/10">
                              <Undo2 size={13} /> Undo graduation
                            </button>
                          )}
                        </div>

                        {editing === s.studentId && (
                          <div className="irms-enter-down mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-gold/40 p-3">
                            <label className="text-xs text-navy/60">
                              Core credits needed
                              <input type="number" min={0} max={50} value={req.core} onChange={(e) => setReq({ ...req, core: e.target.value })} className="mt-1 block w-24 rounded border border-navy/20 px-2 py-1 text-sm" />
                            </label>
                            <label className="text-xs text-navy/60">
                              Elective credits needed
                              <input type="number" min={0} max={50} value={req.elective} onChange={(e) => setReq({ ...req, elective: e.target.value })} className="mt-1 block w-24 rounded border border-navy/20 px-2 py-1 text-sm" />
                            </label>
                            <button onClick={() => saveRequirements(s)} disabled={busy} className="rounded bg-navy px-3 py-1.5 text-sm font-medium text-parchment hover:bg-gold hover:text-navy">
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
