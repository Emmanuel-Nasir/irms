"use client";

import { useEffect, useState } from "react";

type ClassItem = { id: string; name: string };

export default function ExportPage() {
  const [stakes, setStakes] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [stakeFilter, setStakeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => {
    fetch("/api/students")
      .then((res) => res.json())
      .then((students: { stake: string | null }[]) => {
        const unique = Array.from(new Set(students.map((s) => s.stake).filter(Boolean))) as string[];
        setStakes(unique);
      });
    fetch("/api/classes")
      .then((res) => res.json())
      .then(setClasses);
  }, []);

  function handleDownload() {
    const params = new URLSearchParams();
    if (stakeFilter) params.set("stake", stakeFilter);
    if (classFilter) params.set("classId", classFilter);
    window.location.href = `/api/export/students?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-2 font-display text-2xl text-navy">Export Data</h1>
      <p className="mb-8 text-sm text-navy/60">
        Download student records as a spreadsheet (CSV) — opens directly in Excel or Google Sheets.
      </p>

      <div className="max-w-md rounded border-t-4 border-gold bg-white p-6 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-navy/80">Filter by Stake</label>
        <select value={stakeFilter} onChange={(e) => setStakeFilter(e.target.value)}
          className="mb-4 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
          <option value="">All Stakes</option>
          {stakes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <label className="mb-1 block text-sm font-medium text-navy/80">Filter by Class</label>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          className="mb-6 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold">
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <button onClick={handleDownload}
          className="w-full rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy">
          Download CSV
        </button>
      </div>
    </div>
  );
}