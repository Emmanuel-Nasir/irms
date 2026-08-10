"use client";

import { useEffect, useState } from "react";

type Semester = { id: string; name: string };
type Teacher = { id: string; user: { name: string } };
type ClassItem = {
  id: string; name: string; category: string;
  dayOfWeek: number | null; startTime: string | null; venue: string | null;
  teacherId: string | null; semester: { name: string };
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("SCRIPTURE_STUDY");
  const [semesterId, setSemesterId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("");
  const [venue, setVenue] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    const [classesRes, semestersRes, teachersRes] = await Promise.all([
      fetch("/api/classes"), fetch("/api/semesters"), fetch("/api/teachers"),
    ]);
    setClasses(await classesRes.json());
    setSemesters(await semestersRes.json());
    setTeachers(await teachersRes.json());
    
  }

  useEffect(() => { loadData(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, semesterId, dayOfWeek, startTime, venue }),
    });
    setName(""); setDayOfWeek(""); setStartTime(""); setVenue("");
    setLoading(false);
    loadData();
  }

  async function assignTeacher(classId: string, teacherId: string) {
    await fetch(`/api/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: teacherId || null }),
    });
    loadData();
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-3xl font-display text-2xl tracking-wide text-parchment">Classes</h1>
      </header>

      <main className="mx-auto max-w-3xl px-8 py-10">
        <form onSubmit={handleSubmit} className="mb-8 rounded border-l-4 border-gold bg-white p-6 shadow-sm">
          <input placeholder="Class name (e.g. Book of Mormon)" value={name} onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
            <option value="SCRIPTURE_STUDY">Scripture Study</option>
            <option value="MISSIONARY_PREP">Missionary Prep</option>
            <option value="INSTITUTE_FOUNDATIONS">Institute Foundations</option>
            <option value="OTHER">Other</option>
          </select>
          <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required>
            <option value="">Select a semester</option>
            {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
            <option value="">Day of week</option>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input placeholder="Start time (e.g. 18:00)" value={startTime} onChange={(e) => setStartTime(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          <input placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          <button type="submit" disabled={loading}
            className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
            {loading ? "Creating..." : "Create Class"}
          </button>
        </form>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">All Classes</p>
        <div className="space-y-3">
          {classes.map((c) => (
            <div key={c.id} className="rounded border border-navy/10 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
              <p className="font-medium text-navy">{c.name}</p>
              <p className="text-sm text-navy/60">
                {c.semester.name} · {c.category}
                {c.dayOfWeek !== null && ` · ${DAYS[c.dayOfWeek]}`}
                {c.startTime && ` ${c.startTime}`}
                {c.venue && ` · ${c.venue}`}
              </p>
              <select value={c.teacherId ?? ""} onChange={(e) => assignTeacher(c.id, e.target.value)}
                className="mt-2 rounded border border-navy/20 px-2 py-1 text-sm outline-none focus:border-gold">
                <option value="">No teacher assigned</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.user.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}