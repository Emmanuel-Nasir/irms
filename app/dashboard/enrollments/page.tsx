"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";

type Student = { id: string; user: { name: string } };
type ClassItem = { id: string; name: string; archived?: boolean };
type Enrollment = {
  id: string;
  type: "IN_PERSON" | "INDEPENDENT_STUDY";
  status: "ACTIVE" | "DROPPED" | "COMPLETED";
  studentId: string;
  classId: string;
  student: { user: { name: string } };
  class: { name: string };
};

const STATUS_PILL = {
  ACTIVE: "bg-gold/25 text-navy",
  COMPLETED: "bg-sage/15 text-sage",
  DROPPED: "bg-navy/10 text-navy/50",
};

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [type, setType] = useState("IN_PERSON");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  async function loadData() {
    const [eRes, sRes, cRes] = await Promise.all([fetch("/api/enrollments"), fetch("/api/students"), fetch("/api/classes")]);
    if (eRes.ok) setEnrollments(await eRes.json());
    if (sRes.ok) setStudents(await sRes.json());
    if (cRes.ok) setClasses(await cRes.json());
  }
  useEffect(() => {
    loadData();
  }, []);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, classId, type }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
      return;
    }
    flash("Enrolled");
    setStudentId("");
    loadData();
  }

  async function change(en: Enrollment, body: Record<string, string>, message: string) {
    setError("");
    const res = await fetch(`/api/enrollments/${en.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
      return;
    }
    flash(message);
    loadData();
  }

  async function remove(en: Enrollment) {
    if (!window.confirm(`Remove ${en.student.user.name} from ${en.class.name}? Their past attendance stays on record.`)) return;
    const res = await fetch(`/api/enrollments/${en.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Something went wrong");
      return;
    }
    flash("Removed");
    loadData();
  }

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      enrollments.filter(
        (en) =>
          (!classFilter || en.classId === classFilter) &&
          (!statusFilter || en.status === statusFilter) &&
          (!q || `${en.student.user.name} ${en.class.name}`.toLowerCase().includes(q))
      ),
    [enrollments, classFilter, statusFilter, q]
  );

  const field = "w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold";
  const small = "rounded border border-navy/20 bg-white px-2 py-1 text-xs outline-none focus:border-gold";

  return (
    <div className="min-h-screen bg-parchment">
      {toast && (
        <div className="irms-toast fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-2xl">
          ✓ {toast}
        </div>
      )}
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-4xl font-display text-2xl tracking-wide text-parchment">Enrollments</h1>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
        <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded-xl border-l-4 border-gold bg-white p-6 shadow-sm sm:grid-cols-[1fr_1fr_auto_auto]">
          {error && <p className="rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay sm:col-span-4">{error}</p>}
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={field} required>
            <option value="">Select a student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.user.name}
              </option>
            ))}
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={field} required>
            <option value="">Select a class</option>
            {classes
              .filter((c) => !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
            <option value="IN_PERSON">In person</option>
            <option value="INDEPENDENT_STUDY">Independent study</option>
          </select>
          <button type="submit" disabled={loading} className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
            {loading ? "Enrolling..." : "Enroll"}
          </button>
        </form>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
            <input placeholder="Search student or class" value={search} onChange={(e) => setSearch(e.target.value)} className={`${field} pl-9`} />
          </div>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={`${field} sm:w-48`}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${field} sm:w-40`}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">
          {visible.length} enrollment{visible.length !== 1 ? "s" : ""}
        </p>
        <div className="space-y-2">
          {visible.map((en) => (
            <div key={en.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-navy/10 bg-white p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy">
                  <Link href={`/dashboard/students/${en.studentId}`} className="hover:text-gold">
                    {en.student.user.name}
                  </Link>{" "}
                  <span className="text-navy/40">→</span>{" "}
                  <Link href={`/dashboard/class/${en.classId}`} className="hover:text-gold">
                    {en.class.name}
                  </Link>
                </p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_PILL[en.status]}`}>
                  {en.status.toLowerCase()}
                </span>
              </div>
              <select value={en.status} onChange={(e) => change(en, { status: e.target.value }, "Status updated")} className={small} aria-label="Status">
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed (credit)</option>
                <option value="DROPPED">Dropped</option>
              </select>
              <select value={en.type} onChange={(e) => change(en, { type: e.target.value }, "Type updated")} className={small} aria-label="Type">
                <option value="IN_PERSON">In person</option>
                <option value="INDEPENDENT_STUDY">Independent study</option>
              </select>
              <button onClick={() => remove(en)} className="rounded p-1.5 text-clay hover:bg-clay/10" aria-label="Remove enrollment">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {visible.length === 0 && <p className="py-8 text-center text-sm text-navy/50">No enrollments match.</p>}
        </div>
      </main>
    </div>
  );
}
