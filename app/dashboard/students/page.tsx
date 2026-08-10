"use client";

import { useEffect, useState } from "react";

type StudentItem = { id: string; ward: string | null; stake: string | null; phone: string | null; user: { name: string; email: string } };

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [stakeFilter, setStakeFilter] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [ward, setWard] = useState("");
  const [stake, setStake] = useState(""); const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function loadStudents() {
    const res = await fetch("/api/students");
    setStudents(await res.json());
  }

  useEffect(() => { loadStudents(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, ward, stake, phone }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    setName(""); setEmail(""); setPassword(""); setWard(""); setStake(""); setPhone("");
    loadStudents();
  }

  const uniqueStakes = Array.from(new Set(students.map((s) => s.stake).filter(Boolean))) as string[];
  const filteredStudents = stakeFilter ? students.filter((s) => s.stake === stakeFilter) : students;

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <h1 className="mx-auto max-w-3xl font-display text-2xl tracking-wide text-parchment">Students</h1>
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
          <input placeholder="Ward" value={ward} onChange={(e) => setWard(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          <input placeholder="Stake" value={stake} onChange={(e) => setStake(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          <button type="submit" disabled={loading}
            className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
            {loading ? "Registering..." : "Register Student"}
          </button>
        </form>

        {uniqueStakes.length > 0 && (
          <select value={stakeFilter} onChange={(e) => setStakeFilter(e.target.value)}
            className="mb-4 rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold">
            <option value="">All Stakes</option>
            {uniqueStakes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">All Students</p>
        <div className="space-y-3">
          {filteredStudents.map((s) => (
            <div key={s.id} className="rounded border border-navy/10 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
              <p className="font-medium text-navy">{s.user.name}</p>
              <p className="text-sm text-navy/60">
                {s.user.email}{s.ward && ` · ${s.ward} Ward`}{s.stake && ` · ${s.stake} Stake`}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}