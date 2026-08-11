"use client";

import { useEffect, useState } from "react";

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

  async function loadData() {
    const [aRes, cRes, sRes] = await Promise.all([
      fetch("/api/announcements"), fetch("/api/classes"), fetch("/api/students"),
    ]);
    setAnnouncements(await aRes.json());
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

      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-navy/50">All Announcements</p>
      <div className="max-w-2xl space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="rounded border-t-4 border-gold bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="font-display text-lg text-navy">{a.title}</p>
              <span className="text-xs text-navy/40">{new Date(a.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="mb-2 text-sm text-navy/80">{a.body}</p>
            <p className="text-xs text-navy/40">
              By {a.author.name} · {a.class ? a.class.name : "Stake-wide"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}