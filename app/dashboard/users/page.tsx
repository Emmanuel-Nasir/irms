"use client";

import { useEffect, useState } from "react";
import {
  KeyRound, LockOpen, LogOut, MapPin, Pencil, Search, ShieldCheck, Trash2, UserPlus, Users,
} from "lucide-react";
import { TwoFactorRequired, useConfirmPassword } from "@/app/components/ConfirmPassword";
import { CountUp } from "@/app/components/Motion";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  stake: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  locked: boolean;
  twoFactor: boolean;
};

const ROLES = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"];
const SWITCHABLE = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];
const STAKE_ROLES = ["STAKE_ADMIN", "COORDINATOR", "STUDENT"];
const LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  AREA_ADMIN: "Area Admin",
  STAKE_ADMIN: "Stake Admin",
  COORDINATOR: "Coordinator",
  TEACHER: "Teacher",
  STUDENT: "Student",
};
const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-navy text-gold",
  AREA_ADMIN: "bg-navy/80 text-parchment",
  STAKE_ADMIN: "bg-gold/25 text-navy",
  COORDINATOR: "bg-sage/20 text-sage",
  TEACHER: "bg-navy/10 text-navy",
  STUDENT: "bg-parchment text-navy/70 ring-1 ring-navy/10",
};

function ago(iso: string | null) {
  if (!iso) return "Never signed in";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `Signed in ${Math.max(1, mins)} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `Signed in ${h} h ago`;
  return `Signed in ${new Date(iso).toLocaleDateString()}`;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [locked2fa, setLocked2fa] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STUDENT", stake: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const { ask, dialog } = useConfirmPassword();

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) {
      setUsers(await res.json());
      setLocked2fa(false);
    } else {
      const data = await res.json().catch(() => ({}));
      if (data.code === "TWO_FACTOR_REQUIRED") setLocked2fa(true);
      else setError(data.error ?? "Couldn't load users");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 3000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong");
      return;
    }
    flash(`${form.name} added.`);
    setForm({ name: "", email: "", password: "", role: form.role, stake: form.stake });
    setShowAdd(false);
    load();
  }

  async function update(u: UserItem, changes: Record<string, unknown>, done: string) {
    setError("");
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong");
      return;
    }
    flash(done);
    load();
  }

  function editDetails(u: UserItem) {
    const name = window.prompt("Name:", u.name);
    if (!name) return;
    const email = window.prompt("Email:", u.email);
    if (!email) return;
    update(u, { name, email }, `${name} updated.`);
  }

  function editStake(u: UserItem) {
    const stake = window.prompt(
      `Stake for ${u.name}${u.role === "STUDENT" ? "" : " (they'll only see students in this stake)"}:`,
      u.stake ?? ""
    );
    if (stake === null) return;
    update(u, { stake }, `${u.name}'s stake updated.`);
  }

  async function changeRole(u: UserItem, role: string) {
    const pw = await ask(`Change ${u.name} from ${LABEL[u.role]} to ${LABEL[role]}?`);
    if (pw) update(u, { role, confirmPassword: pw }, `${u.name} is now ${LABEL[role]}.`);
  }

  async function resetPassword(u: UserItem) {
    const newPassword = window.prompt(`New password for ${u.name} (8+ characters, with a letter and a number):`);
    if (!newPassword) return;
    const pw = await ask(`Reset ${u.name}'s password? They'll be signed out everywhere.`, false);
    if (pw) update(u, { newPassword, confirmPassword: pw }, `${u.name}'s password was reset.`);
  }

  async function remove(u: UserItem) {
    const pw = await ask(`Delete ${u.name} for good? Their enrollments and attendance are deleted too.`);
    if (!pw) return;
    const res = await fetch(`/api/users/${u.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmPassword: pw }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong");
      return;
    }
    flash(`${u.name} deleted.`);
    load();
  }

  const visible = users.filter(
    (u) =>
      (!roleFilter || u.role === roleFilter) &&
      `${u.name} ${u.email} ${u.stake ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const counts = ROLES.map((r) => ({ role: r, n: users.filter((u) => u.role === r).length }));

  const field = "w-full rounded-lg border border-navy/20 bg-white px-3 py-2 outline-none focus:border-gold";
  const action =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy/70 transition-colors hover:bg-parchment hover:text-navy";

  if (locked2fa) {
    return (
      <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
        <h1 className="mb-6 font-display text-2xl text-navy">All Users</h1>
        <div className="max-w-xl">
          <TwoFactorRequired />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
      {dialog}
      {notice && (
        <div className="irms-toast fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-2xl">
          ✓ {notice}
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl text-navy">
              <Users className="text-gold" /> All Users
            </h1>
            <p className="text-sm text-navy/60">
              <CountUp value={users.length} /> accounts. Changing roles, resetting passwords and deleting ask for your
              password.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="irms-shine flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-parchment shadow-lg hover:bg-gold hover:text-navy"
          >
            <UserPlus size={16} /> {showAdd ? "Close" : "Add user"}
          </button>
        </div>

        {/* Role counts double as filters */}
        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {counts.map((c) => (
            <button
              key={c.role}
              onClick={() => setRoleFilter(roleFilter === c.role ? "" : c.role)}
              className={`rounded-xl border p-3 text-left shadow-sm transition-all ${
                roleFilter === c.role ? "border-gold bg-gold/15" : "border-navy/10 bg-white hover:border-gold"
              }`}
            >
              <p className="font-display text-2xl text-navy">
                <CountUp value={c.n} />
              </p>
              <p className="truncate text-[11px] uppercase tracking-wider text-navy/55">{LABEL[c.role]}</p>
            </button>
          ))}
        </div>

        {error && <p className="mb-4 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

        {showAdd && (
          <form onSubmit={handleCreate} className="irms-enter-down mb-6 grid gap-3 rounded-2xl border-t-4 border-gold bg-white p-5 shadow-sm sm:grid-cols-2">
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} required />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} required />
            <input placeholder="Temporary password (8+, letter and number)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} required />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={field}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {LABEL[r]}
                </option>
              ))}
            </select>
            {STAKE_ROLES.includes(form.role) && (
              <input placeholder="Stake (e.g. Abeokuta Oke-Ata)" value={form.stake} onChange={(e) => setForm({ ...form, stake: e.target.value })} className={field} />
            )}
            <button type="submit" disabled={loading} className="rounded-lg bg-navy px-4 py-2 font-medium text-parchment hover:bg-gold hover:text-navy disabled:opacity-50 sm:col-span-2">
              {loading ? "Adding..." : "Add user"}
            </button>
          </form>
        )}

        <div className="relative mb-4">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
          <input
            placeholder="Search name, email or stake"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${field} pl-10`}
          />
        </div>

        <div className="space-y-2">
          {visible.map((u) => (
            <div key={u.id} className="rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-light font-display text-parchment">
                    {u.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-navy">
                      {u.name}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_COLOR[u.role]}`}>
                        {LABEL[u.role]}
                      </span>
                      {u.twoFactor && (
                        <span title="Two-step sign-in on" className="text-sage">
                          <ShieldCheck size={15} />
                        </span>
                      )}
                      {u.locked && (
                        <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-clay">Locked</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-navy/60">{u.email}</p>
                    <p className="text-xs text-navy/45">
                      {u.stake ? `${u.stake} · ` : STAKE_ROLES.includes(u.role) && u.role !== "STUDENT" ? "No stake set (sees all stakes) · " : ""}
                      {ago(u.lastLoginAt)}
                    </p>
                  </div>
                </div>
                {SWITCHABLE.includes(u.role) && (
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="rounded-lg border border-navy/20 bg-white px-2 py-1 text-sm"
                  >
                    {SWITCHABLE.map((r) => (
                      <option key={r} value={r}>
                        {LABEL[r]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1 border-t border-navy/5 pt-2">
                <button onClick={() => editDetails(u)} className={action}>
                  <Pencil size={13} /> Edit
                </button>
                {STAKE_ROLES.includes(u.role) && (
                  <button onClick={() => editStake(u)} className={action}>
                    <MapPin size={13} /> Stake
                  </button>
                )}
                <button onClick={() => resetPassword(u)} className={action}>
                  <KeyRound size={13} /> Reset password
                </button>
                {u.locked && (
                  <button onClick={() => update(u, { unlock: true }, `${u.name} unlocked.`)} className={action}>
                    <LockOpen size={13} /> Unlock
                  </button>
                )}
                <button onClick={() => update(u, { signOut: true }, `${u.name} signed out everywhere.`)} className={action}>
                  <LogOut size={13} /> Sign out
                </button>
                <button onClick={() => remove(u)} className={`${action} text-clay hover:bg-clay/10 hover:text-clay`}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
          {visible.length === 0 && <p className="py-8 text-center text-sm text-navy/50">No users match.</p>}
        </div>
      </div>
    </div>
  );
}
