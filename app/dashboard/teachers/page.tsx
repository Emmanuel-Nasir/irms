"use client";

import { useEffect, useState } from "react";

type TeacherItem = { id: string; phone: string | null; user: { name: string; email: string } };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function loadTeachers() {
    const res = await fetch("/api/teachers");
    setTeachers(await res.json());
  }

  useEffect(() => { loadTeachers(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    setName(""); setEmail(""); setPassword(""); setPhone("");
    loadTeachers();
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-3xl font-display text-2xl tracking-wide text-parchment">Teachers</h1>
      </header>

      <main className="mx-auto max-w-3xl px-8 py-10">
        <form onSubmit={handleSubmit} className="mb-8 rounded border-l-4 border-gold bg-white p-6 shadow-sm">
          {error && <p className="mb-3 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
          <input placeholder="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          <button type="submit" disabled={loading}
            className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
            {loading ? "Adding..." : "Add Teacher"}
          </button>
        </form>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">All Teachers</p>
        <div className="space-y-3">
          {teachers.map((t) => (
            <div key={t.id} className="rounded border border-navy/10 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
              <p className="font-medium text-navy">{t.user.name}</p>
              <p className="text-sm text-navy/60">{t.user.email}{t.phone && ` · ${t.phone}`}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}