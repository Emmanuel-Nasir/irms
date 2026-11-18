"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

type StudentItem = { id: string; ward: string | null; stake: string | null; phone: string | null; user: { name: string; email: string } };

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [stakeFilter, setStakeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [ward, setWard] = useState("");
  const [stake, setStake] = useState(""); const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function loadStudents() {
    const res = await fetch("/api/students");
    if (res.ok) setStudents(await res.json());
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
  const q = search.trim().toLowerCase();
  const filteredStudents = students.filter(
    (s) =>
      (!stakeFilter || s.stake === stakeFilter) &&
      (!q || `${s.user.name} ${s.user.email} ${s.ward ?? ""} ${s.phone ?? ""}`.toLowerCase().includes(q))
  );

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

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
            <input placeholder="Search name, email, ward or phone" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-navy/20 py-2 pl-9 pr-3 text-sm outline-none focus:border-gold" />
          </div>
          {uniqueStakes.length > 0 && (
            <select value={stakeFilter} onChange={(e) => setStakeFilter(e.target.value)}
              className="rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold">
              <option value="">All Stakes</option>
              {uniqueStakes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">{filteredStudents.length} students · tap one to see their profile</p>
        <div className="space-y-3">
          {filteredStudents.map((s) => (
            <Link key={s.id} href={`/dashboard/students/${s.id}`} className="group flex items-center gap-3 rounded-xl border border-navy/10 bg-white p-4 shadow-sm hover:border-gold">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-light font-display text-parchment">
                {s.user.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-navy">{s.user.name}</span>
                <span className="block truncate text-sm text-navy/60">
                  {s.user.email}{s.ward && ` · ${s.ward} Ward`}{s.stake && ` · ${s.stake} Stake`}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-navy/30 transition-transform group-hover:translate-x-1 group-hover:text-gold" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}