"use client";

import { useEffect, useState } from "react";

type Student = { id: string; user: { name: string } };
type ClassItem = { id: string; name: string };
type Enrollment = { id: string; type: string; status: string; student: { user: { name: string } }; class: { name: string } };

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentId, setStudentId] = useState(""); const [classId, setClassId] = useState("");
  const [type, setType] = useState("IN_PERSON");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function loadData() {
    const [eRes, sRes, cRes] = await Promise.all([
      fetch("/api/enrollments"), fetch("/api/students"), fetch("/api/classes"),
    ]);
    setEnrollments(await eRes.json());
    setStudents(await sRes.json());
    setClasses(await cRes.json());
  }

  useEffect(() => { loadData(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, classId, type }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    setStudentId(""); setClassId("");
    loadData();
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-3xl font-display text-2xl tracking-wide text-parchment">Enrollments</h1>
      </header>

      <main className="mx-auto max-w-3xl px-8 py-10">
        <form onSubmit={handleSubmit} className="mb-8 rounded border-l-4 border-gold bg-white p-6 shadow-sm">
          {error && <p className="mb-3 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required>
            <option value="">Select a student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required>
            <option value="">Select a class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
            <option value="IN_PERSON">In Person</option>
            <option value="INDEPENDENT_STUDY">Independent Study</option>
          </select>
          <button type="submit" disabled={loading}
            className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
            {loading ? "Enrolling..." : "Enroll Student"}
          </button>
        </form>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">All Enrollments</p>
        <div className="space-y-3">
          {enrollments.map((en) => (
            <div key={en.id} className="rounded border border-navy/10 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
              <p className="font-medium text-navy">{en.student.user.name} → {en.class.name}</p>
              <p className="text-sm text-navy/60">{en.type} · {en.status}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}