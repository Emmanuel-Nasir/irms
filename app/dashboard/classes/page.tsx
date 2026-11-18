"use client";

import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, CalendarRange, Clock, Pencil, Trash2 } from "lucide-react";
import { useConfirmPassword } from "@/app/components/ConfirmPassword";
import { Meter } from "@/app/components/Motion";

type Semester = { id: string; name: string; startDate: string; endDate: string };
type Teacher = { id: string; user: { name: string } };
type Progress = {
  startKey: string;
  endKey: string;
  lengthDays: number;
  totalClasses: number | null;
  classesSoFar: number | null;
  classesLeft: number | null;
  status: "upcoming" | "running" | "finished";
};
type ClassItem = {
  id: string;
  name: string;
  category: string;
  dayOfWeek: number | null;
  startTime: string | null;
  venue: string | null;
  teacherId: string | null;
  creditType: "CORE" | "ELECTIVE";
  archived: boolean;
  startDate: string | null;
  semester: { name: string };
  progress?: Progress;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CATEGORY_OPTIONS = [
  { value: "CORNERSTONE", label: "Cornerstone" },
  { value: "GOSPEL", label: "Gospel Courses" },
  { value: "SCRIPTURE", label: "Scripture Courses" },
  { value: "OTHER", label: "Other" },
];

// Old values still show properly on classes created before this change
const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label])),
  SCRIPTURE_STUDY: "Scripture Courses",
  MISSIONARY_PREP: "Missionary Prep",
  INSTITUTE_FOUNDATIONS: "Institute Foundations",
};

function addDaysKey(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function niceDate(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
// How many times a class on this weekday meets between two dates (inclusive)
function countClasses(startKey: string, days: number, dow: number) {
  let n = 0;
  for (let i = 0; i < days; i++) {
    if (new Date(`${addDaysKey(startKey, i)}T12:00:00Z`).getUTCDay() === dow) n++;
  }
  return n;
}

function PeriodPreview({ start, days, dow }: { start: string; days: string; dow: string }) {
  const n = Number(days);
  if (!start || !Number.isInteger(n) || n < 1) return null;
  const end = addDaysKey(start, n - 1);
  return (
    <p className="mb-3 rounded-lg bg-gold/10 px-3 py-2 text-sm text-navy">
      Runs <b>{niceDate(start)}</b> to <b>{niceDate(end)}</b> ({n} day{n !== 1 ? "s" : ""}).
      {dow !== "" ? (
        <>
          {" "}
          That&apos;s <b>{countClasses(start, n, Number(dow))} classes</b> on {DAYS[Number(dow)]}s.
        </>
      ) : (
        " Pick a day of the week to see how many classes that is."
      )}
    </p>
  );
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("CORNERSTONE");
  const [creditType, setCreditType] = useState("CORE");
  const [semesterId, setSemesterId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [lengthDays, setLengthDays] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editDays, setEditDays] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [details, setDetails] = useState({ name: "", dayOfWeek: "", startTime: "", venue: "" });
  const { ask, dialog } = useConfirmPassword();

  async function loadData() {
    const [classesRes, semestersRes, teachersRes] = await Promise.all([
      fetch("/api/classes"),
      fetch("/api/semesters"),
      fetch("/api/teachers"),
    ]);
    if (classesRes.ok) setClasses(await classesRes.json());
    if (semestersRes.ok) setSemesters(await semestersRes.json());
    if (teachersRes.ok) setTeachers(await teachersRes.json());
  }

  useEffect(() => {
    loadData();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => setIsSuper(me?.role === "SUPER_ADMIN"))
      .catch(() => {});
  }, []);

  async function removeClass(c: ClassItem) {
    const pw = await ask(`Delete ${c.name} for good? Its attendance, enrollments, lessons and materials are deleted too. (Archive it instead to keep the records.)`);
    if (!pw) return;
    setError("");
    const res = await fetch(`/api/classes/${c.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmPassword: pw }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't delete");
      return;
    }
    loadData();
  }

  // Picking a semester fills in its dates, which the coordinator can then shorten
  function pickSemester(id: string) {
    setSemesterId(id);
    const s = semesters.find((x) => x.id === id);
    if (s && !startDate) {
      const start = s.startDate.slice(0, 10);
      const days = Math.round((Date.parse(s.endDate) - Date.parse(s.startDate)) / 86400000) + 1;
      setStartDate(start);
      setLengthDays(String(Math.max(1, days)));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, creditType, semesterId, dayOfWeek, startTime, venue, startDate, lengthDays }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
      return;
    }
    setName("");
    setDayOfWeek("");
    setStartTime("");
    setVenue("");
    setStartDate("");
    setLengthDays("");
    loadData();
  }

  async function patch(classId: string, body: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
      return false;
    }
    loadData();
    return true;
  }

  function startEditing(c: ClassItem) {
    setEditing(c.id);
    setEditStart(c.progress?.startKey ?? "");
    setEditDays(c.progress ? String(c.progress.lengthDays) : "");
  }

  const field = "mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold";

  return (
    <div className="min-h-screen bg-parchment">
      {dialog}
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-3xl font-display text-2xl tracking-wide text-parchment">Classes</h1>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
        {error && <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

        <form onSubmit={handleSubmit} className="mb-8 rounded border-l-4 border-gold bg-white p-6 shadow-sm">
          <input placeholder="Course name (e.g. Book of Mormon)" value={name} onChange={(e) => setName(e.target.value)} className={field} required />

          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select value={creditType} onChange={(e) => setCreditType(e.target.value)} className={field}>
            <option value="CORE">Counts as a core credit for graduation</option>
            <option value="ELECTIVE">Counts as an elective credit for graduation</option>
          </select>

          <select value={semesterId} onChange={(e) => pickSemester(e.target.value)} className={field} required>
            <option value="">Select a semester</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={field}>
            <option value="">Day of week</option>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/60">Starts on</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy/60">Lasts (days)</label>
              <input
                type="number"
                min={1}
                max={730}
                placeholder="e.g. 84 for 12 weeks"
                value={lengthDays}
                onChange={(e) => setLengthDays(e.target.value)}
                className={field}
              />
            </div>
          </div>
          <PeriodPreview start={startDate} days={lengthDays} dow={dayOfWeek} />

          <input placeholder="Start time (e.g. 18:00)" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} />
          <input placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} className={field} />

          <button
            type="submit"
            disabled={loading}
            className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Class"}
          </button>
        </form>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-navy/50">All Classes</p>
          {classes.some((c) => c.archived) && (
            <label className="flex items-center gap-2 text-xs text-navy/60">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived ({classes.filter((c) => c.archived).length})
            </label>
          )}
        </div>
        <div className="space-y-3">
          {classes.filter((c) => showArchived || !c.archived).map((c) => {
            const p = c.progress;
            return (
              <div key={c.id} className={`rounded-xl border border-navy/10 bg-white p-4 shadow-sm ${c.archived ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-navy">
                    {c.name}
                    {c.archived && <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-navy/60">Archived</span>}
                  </p>
                  <a
                    href={`/dashboard/class/${c.id}`}
                    className="shrink-0 rounded-full bg-navy px-3 py-1 text-xs font-medium text-parchment transition-all hover:bg-gold hover:text-navy"
                  >
                    Open class →
                  </a>
                </div>
                <p className="text-sm text-navy/60">
                  {c.semester.name} · {CATEGORY_LABELS[c.category] ?? c.category} ·{" "}
                  <button
                    onClick={() => patch(c.id, { creditType: c.creditType === "CORE" ? "ELECTIVE" : "CORE" })}
                    title="Click to switch between core and elective"
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${c.creditType === "CORE" ? "bg-navy text-parchment" : "bg-gold/30 text-navy"}`}
                  >
                    {c.creditType === "CORE" ? "Core credit" : "Elective credit"}
                  </button>
                  {c.dayOfWeek !== null && ` · ${DAYS[c.dayOfWeek]}`}
                  {c.startTime && ` ${c.startTime}`}
                  {c.venue && ` · ${c.venue}`}
                </p>

                {p && (
                  <div className="mt-3 rounded-lg bg-parchment/70 p-3">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/70">
                      <span className="flex items-center gap-1.5">
                        <CalendarRange size={14} className="text-gold" />
                        {niceDate(p.startKey)} – {niceDate(p.endKey)} ({p.lengthDays} days)
                        {!c.startDate && <span className="text-navy/40">(semester dates)</span>}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock size={14} className="text-gold" />
                        {p.totalClasses === null
                          ? "Set a day to count classes"
                          : p.status === "upcoming"
                          ? `${p.totalClasses} classes · starts soon`
                          : p.status === "finished"
                          ? `${p.totalClasses} classes · finished`
                          : `Class ${p.classesSoFar} of ${p.totalClasses}`}
                      </span>
                    </div>
                    {p.totalClasses !== null && p.totalClasses > 0 && (
                      <Meter percent={((p.classesSoFar ?? 0) / p.totalClasses) * 100} color="bg-gold" />
                    )}
                  </div>
                )}

                {editing === c.id ? (
                  <div className="irms-enter-down mt-3 rounded-lg border border-gold/40 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-navy/60">Starts on</label>
                        <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={field} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-navy/60">Lasts (days)</label>
                        <input type="number" min={1} max={730} value={editDays} onChange={(e) => setEditDays(e.target.value)} className={field} />
                      </div>
                    </div>
                    <PeriodPreview start={editStart} days={editDays} dow={c.dayOfWeek === null ? "" : String(c.dayOfWeek)} />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          if (await patch(c.id, { startDate: editStart, lengthDays: editDays })) setEditing(null);
                        }}
                        className="rounded bg-navy px-3 py-1.5 text-sm font-medium text-parchment hover:bg-gold hover:text-navy"
                      >
                        Save period
                      </button>
                      <button
                        onClick={async () => {
                          if (await patch(c.id, { startDate: null })) setEditing(null);
                        }}
                        className="rounded px-3 py-1.5 text-sm text-navy/60 hover:text-navy"
                      >
                        Use semester dates
                      </button>
                      <button onClick={() => setEditing(null)} className="rounded px-3 py-1.5 text-sm text-navy/60 hover:text-navy">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={c.teacherId ?? ""}
                    onChange={(e) => patch(c.id, { teacherId: e.target.value || null })}
                    className="rounded border border-navy/20 px-2 py-1 text-sm outline-none focus:border-gold"
                  >
                    <option value="">No teacher assigned</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.user.name}
                      </option>
                    ))}
                  </select>
                  {editing !== c.id && (
                    <button onClick={() => startEditing(c)} className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-navy hover:bg-parchment">
                      <CalendarRange size={14} /> Set period
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDetailsFor(detailsFor === c.id ? null : c.id);
                      setDetails({ name: c.name, dayOfWeek: c.dayOfWeek === null ? "" : String(c.dayOfWeek), startTime: c.startTime ?? "", venue: c.venue ?? "" });
                    }}
                    className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-navy hover:bg-parchment"
                  >
                    <Pencil size={14} /> Edit details
                  </button>
                  <button
                    onClick={() => patch(c.id, { archived: !c.archived })}
                    className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-navy/70 hover:bg-parchment"
                    title={c.archived ? "Bring back" : "Hide from lists but keep its records"}
                  >
                    {c.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {c.archived ? "Restore" : "Archive"}
                  </button>
                  {isSuper && (
                    <button onClick={() => removeClass(c)} className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-clay hover:bg-clay/10">
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>

                {detailsFor === c.id && (
                  <div className="irms-enter-down mt-3 rounded-lg border border-gold/40 p-3">
                    <input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} className={field} placeholder="Class name" />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <select value={details.dayOfWeek} onChange={(e) => setDetails({ ...details, dayOfWeek: e.target.value })} className={field}>
                        <option value="">No set day</option>
                        {DAYS.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <input value={details.startTime} onChange={(e) => setDetails({ ...details, startTime: e.target.value })} className={field} placeholder="Time (e.g. 18:00)" />
                      <input value={details.venue} onChange={(e) => setDetails({ ...details, venue: e.target.value })} className={field} placeholder="Venue" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (await patch(c.id, details)) setDetailsFor(null);
                        }}
                        className="rounded bg-navy px-3 py-1.5 text-sm font-medium text-parchment hover:bg-gold hover:text-navy"
                      >
                        Save details
                      </button>
                      <button onClick={() => setDetailsFor(null)} className="rounded px-3 py-1.5 text-sm text-navy/60 hover:text-navy">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
