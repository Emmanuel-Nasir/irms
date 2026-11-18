"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Lock, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { useConfirmPassword } from "@/app/components/ConfirmPassword";

type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "CLOSED";
  _count?: { classes: number };
};

const PILL = {
  ACTIVE: "bg-sage text-white",
  UPCOMING: "bg-gold/25 text-navy",
  CLOSED: "bg-navy/10 text-navy/60",
};

function d(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}
function input(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(iso));
}

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", startDate: "", endDate: "" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const { ask, dialog } = useConfirmPassword();

  async function load() {
    const res = await fetch("/api/semesters");
    if (res.ok) setSemesters(await res.json());
  }
  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => setIsSuper(me?.role === "SUPER_ADMIN"))
      .catch(() => {});
  }, []);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2800);
  }

  async function send(url: string, method: string, body?: unknown) {
    setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(out.error ?? "Something went wrong");
      return null;
    }
    return out;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const ok = await send("/api/semesters", "POST", { name, startDate, endDate });
    setLoading(false);
    if (!ok) return;
    flash("Semester created");
    setName("");
    setStartDate("");
    setEndDate("");
    load();
  }

  async function setStatus(s: Semester, status: Semester["status"]) {
    if (status === "ACTIVE" && semesters.some((x) => x.status === "ACTIVE" && x.id !== s.id)) {
      if (!window.confirm(`Make ${s.name} the active semester? The current active one will be closed.`)) return;
    }
    if (await send(`/api/semesters/${s.id}`, "PATCH", { status })) {
      flash(status === "ACTIVE" ? `${s.name} is now the active semester` : `${s.name} set to ${status.toLowerCase()}`);
      load();
    }
  }

  async function saveEdit(s: Semester) {
    if (await send(`/api/semesters/${s.id}`, "PATCH", edit)) {
      flash("Saved");
      setEditing(null);
      load();
    }
  }

  async function remove(s: Semester) {
    const pw = await ask(`Delete the semester ${s.name}?`);
    if (!pw) return;
    if (await send(`/api/semesters/${s.id}`, "DELETE", { confirmPassword: pw })) {
      flash("Semester deleted");
      load();
    }
  }

  const field = "w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold";

  return (
    <div className="min-h-screen bg-parchment">
      {dialog}
      {toast && (
        <div className="irms-toast fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-2xl">
          ✓ {toast}
        </div>
      )}
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-3xl font-display text-2xl tracking-wide text-parchment">Semesters</h1>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
        {error && <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

        <form onSubmit={create} className="mb-8 rounded-xl border-l-4 border-gold bg-white p-6 shadow-sm">
          <input placeholder="Semester name (e.g. Semester 1, 2026)" value={name} onChange={(e) => setName(e.target.value)} className={`${field} mb-3`} required />
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-navy/60">
              Starts
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${field} mt-1`} required />
            </label>
            <label className="text-xs text-navy/60">
              Ends
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${field} mt-1`} required />
            </label>
          </div>
          <button type="submit" disabled={loading} className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
            {loading ? "Creating..." : "Create Semester"}
          </button>
        </form>

        {!semesters.some((s) => s.status === "ACTIVE") && semesters.length > 0 && (
          <p className="irms-glow mb-4 rounded-xl border-2 border-gold bg-white px-4 py-3 text-sm text-navy">
            No semester is active yet. Press <b>Make active</b> on the current one so reports and the home page show it.
          </p>
        )}

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">All Semesters</p>
        <div className="space-y-3">
          {semesters.map((s) => (
            <div key={s.id} className={`rounded-xl border bg-white p-4 shadow-sm ${s.status === "ACTIVE" ? "border-sage/50 ring-2 ring-sage/20" : "border-navy/10"}`}>
              {editing === s.id ? (
                <div className="irms-enter-down space-y-3">
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={field} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} className={field} />
                    <input type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} className={field} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(s)} className="rounded bg-navy px-3 py-1.5 text-sm font-medium text-parchment hover:bg-gold hover:text-navy">
                      Save
                    </button>
                    <button onClick={() => setEditing(null)} className="rounded px-3 py-1.5 text-sm text-navy/60 hover:text-navy">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium text-navy">
                      {s.name}
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILL[s.status]}`}>
                        {s.status === "ACTIVE" ? "Active" : s.status === "UPCOMING" ? "Upcoming" : "Closed"}
                      </span>
                    </p>
                    <span className="text-xs text-navy/50">
                      {s._count?.classes ?? 0} class{(s._count?.classes ?? 0) !== 1 ? "es" : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-navy/60">
                    <CalendarDays size={14} className="text-gold" /> {d(s.startDate)} – {d(s.endDate)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-navy/5 pt-2">
                    {s.status !== "ACTIVE" && (
                      <button onClick={() => setStatus(s, "ACTIVE")} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-sage hover:bg-sage/10">
                        <PlayCircle size={14} /> Make active
                      </button>
                    )}
                    {s.status !== "CLOSED" && (
                      <button onClick={() => setStatus(s, "CLOSED")} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy/70 hover:bg-parchment">
                        <Lock size={13} /> Close
                      </button>
                    )}
                    {s.status === "CLOSED" && (
                      <button onClick={() => setStatus(s, "UPCOMING")} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy/70 hover:bg-parchment">
                        <CheckCircle2 size={13} /> Reopen as upcoming
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(s.id);
                        setEdit({ name: s.name, startDate: input(s.startDate), endDate: input(s.endDate) });
                      }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy/70 hover:bg-parchment"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    {isSuper && (
                      <button onClick={() => remove(s)} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-clay hover:bg-clay/10">
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
