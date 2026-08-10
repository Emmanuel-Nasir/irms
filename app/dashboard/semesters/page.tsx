"use client";

import { useEffect, useState } from "react";

type Semester = { id: string; name: string; startDate: string; endDate: string; status: string };

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadSemesters() {
    const res = await fetch("/api/semesters");
    setSemesters(await res.json());
  }

  useEffect(() => { loadSemesters(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/semesters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate, endDate }),
    });
    setName(""); setStartDate(""); setEndDate("");
    setLoading(false);
    loadSemesters();
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-3xl font-display text-2xl tracking-wide text-parchment">Semesters</h1>
      </header>

      <main className="mx-auto max-w-3xl px-8 py-10">
        <form onSubmit={handleSubmit} className="mb-8 rounded border-l-4 border-gold bg-white p-6 shadow-sm">
          <input placeholder="Semester name (e.g. 2026 Semester 1)" value={name} onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
          <div className="mb-3 flex gap-3">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
          </div>
          <button type="submit" disabled={loading}
            className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
            {loading ? "Creating..." : "Create Semester"}
          </button>
        </form>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">All Semesters</p>
        <div className="space-y-3">
          {semesters.map((s) => (
            <div key={s.id} className="rounded border border-navy/10 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
              <p className="font-medium text-navy">{s.name}</p>
              <p className="text-sm text-navy/60">
                {new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()} · {s.status}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}