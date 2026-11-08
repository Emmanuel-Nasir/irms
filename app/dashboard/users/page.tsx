"use client";

import { useEffect, useState } from "react";

type UserItem = { id: string; name: string; email: string; role: string };

const ROLES = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"];
const SWITCHABLE = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong"); return; }
    setName(""); setEmail(""); setPassword("");
    load();
  }

  async function update(id: string, changes: Record<string, string>) {
    setError("");
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong"); return; }
    load();
  }

  function editDetails(u: UserItem) {
    const newName = window.prompt("Name:", u.name);
    if (!newName) return;
    const newEmail = window.prompt("Email:", u.email);
    if (!newEmail) return;
    update(u.id, { name: newName, email: newEmail });
  }

  function resetPassword(u: UserItem) {
    const pw = window.prompt(`New password for ${u.name} (min 6 characters):`);
    if (pw) update(u.id, { newPassword: pw });
  }

  async function remove(u: UserItem) {
    if (!window.confirm(`Delete ${u.name} (${u.role})? Their enrollments and attendance records are deleted too.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong"); return; }
    load();
  }

  const visible = users.filter(
    (u) =>
      (!roleFilter || u.role === roleFilter) &&
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const field = "mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold";

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-8 font-display text-2xl text-navy">All Users</h1>

      <form onSubmit={handleCreate} className="mb-8 max-w-2xl rounded border-l-4 border-gold bg-white p-6 shadow-sm">
        {error && <p className="mb-3 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className={field} required />
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required />
        <input placeholder="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required />
        <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
          {loading ? "Adding..." : "Add User"}
        </button>
      </form>

      <div className="mb-4 flex max-w-2xl gap-3">
        <input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="max-w-2xl space-y-3">
        {visible.map((u) => (
          <div key={u.id} className="rounded border border-navy/10 bg-white p-4 shadow-sm">
            <p className="font-medium text-navy">{u.name}</p>
            <p className="mb-3 text-sm text-navy/60">{u.email}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {SWITCHABLE.includes(u.role) ? (
                <select value={u.role} onChange={(e) => update(u.id, { role: e.target.value })}
                  className="rounded border border-navy/20 px-2 py-1">
                  {SWITCHABLE.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span className="rounded-full bg-navy/5 px-3 py-1 text-xs text-navy/70">{u.role}</span>
              )}
              <button onClick={() => editDetails(u)} className="text-navy hover:underline">Edit</button>
              <button onClick={() => resetPassword(u)} className="text-navy hover:underline">Reset password</button>
              <button onClick={() => remove(u)} className="text-clay hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}