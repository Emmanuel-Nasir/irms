"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

type ClassItem = { id: string; name: string };
type Announcement = {
  id: string; title: string; body: string; createdAt: string;
  author: { name: string }; class: { name: string } | null;
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [classId, setClassId] = useState("");
  const [targetStake, setTargetStake] = useState("");
  const [stakes, setStakes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [error, setError] = useState("");

  async function saveEdit(id: string) {
    setError("");
    const res = await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save");
      return;
    }
    setEditing(null);
    loadData();
  }

  async function remove(a: Announcement) {
    if (!window.confirm(`Delete "${a.title}"? Everyone who could see it will no longer see it.`)) return;
    const res = await fetch(`/api/announcements/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't delete");
      return;
    }
    loadData();
  }

  async function loadData() {
    const [aRes, cRes, sRes] = await Promise.all([
      fetch("/api/announcements"), fetch("/api/classes"), fetch("/api/students"),
    ]);
    if (aRes.ok) setAnnouncements(await aRes.json());
    setClasses(await cRes.json());
    const students: { stake: string | null }[] = await sRes.json();
    setStakes(Array.from(new Set(students.map((s) => s.stake).filter(Boolean))) as string[]);
  }

  useEffect(() => { loadData(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, classId, targetStake }),
    });
    setTitle(""); setBody(""); setClassId(""); setTargetStake("");
    setLoading(false);
    loadData();
  }

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-8 font-display text-2xl text-navy">Announcements</h1>

      <form onSubmit={handleSubmit} className="mb-8 max-w-2xl rounded border-l-4 border-gold bg-white p-6 shadow-sm">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
          className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />
        <textarea placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />

        <select value={classId} onChange={(e) => setClassId(e.target.value)}
          className="mb-3 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
          <option value="">Every class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} only</option>)}
        </select>

        <select value={targetStake} onChange={(e) => setTargetStake(e.target.value)}
          className="mb-4 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
          <option value="">Every stake</option>
          {stakes.map((s) => <option key={s} value={s}>{s} only</option>)}
        </select>

        <button type="submit" disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
          {loading ? "Posting..." : "Post Announcement"}
        </button>
      </form>

      {error && <p className="mb-4 max-w-2xl rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-navy/50">All Announcements</p>
      <div className="max-w-2xl space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="rounded-xl border-t-4 border-gold bg-white p-5 shadow-sm">
            {editing === a.id ? (
              <div className="irms-enter-down space-y-3">
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
                <textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(a.id)} className="rounded bg-navy px-3 py-1.5 text-sm font-medium text-parchment hover:bg-gold hover:text-navy">
                    Save
                  </button>
                  <button onClick={() => setEditing(null)} className="rounded px-3 py-1.5 text-sm text-navy/60 hover:text-navy">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <p className="font-display text-lg text-navy">{a.title}</p>
                  <span className="shrink-0 text-xs text-navy/40">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mb-2 whitespace-pre-line text-sm text-navy/80">{a.body}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-navy/40">
                    By {a.author.name} · {a.class ? a.class.name : "Stake-wide"}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(a.id);
                        setDraft({ title: a.title, body: a.body });
                      }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-navy/60 hover:bg-parchment hover:text-navy"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => remove(a)} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-clay hover:bg-clay/10">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}