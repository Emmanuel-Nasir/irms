"use client";

import { useEffect, useState } from "react";

type ReportData = {
  totals: { students: number; teachers: number; classes: number; stakes: number; activeSemester: string };
  stakes: { stake: string; studentCount: number; barPct: number; classes: { name: string; count: number }[] }[];
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    fetch("/api/reports/stakes").then((res) => res.json()).then(setData);
  }, []);

  if (!data) {
    return <div className="min-h-screen bg-parchment p-8 text-navy/50">Loading...</div>;
  }

  const stats = [
    { label: "Students", value: data.totals.students },
    { label: "Teachers", value: data.totals.teachers },
    { label: "Classes", value: data.totals.classes },
    { label: "Stakes", value: data.totals.stakes },
  ];

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-1 font-display text-2xl text-navy">Reports</h1>
      <p className="mb-8 text-sm text-navy/60">Active semester: {data.totals.activeSemester}</p>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded border-t-4 border-gold bg-white p-5 text-center shadow-sm">
            <p className="font-display text-3xl text-navy">{s.value}</p>
            <p className="text-xs uppercase tracking-widest text-navy/50">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-navy/50">By Stake</p>
      <div className="space-y-4">
        {data.stakes.map((s) => (
          <div key={s.stake} className="rounded border-t-4 border-gold bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="font-display text-lg text-navy">{s.stake}</p>
              <span className="text-sm font-semibold text-navy/70">
                {s.studentCount} student{s.studentCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-navy/10">
              <div className="h-full rounded-full bg-sage transition-all duration-700" style={{ width: `${s.barPct}%` }} />
            </div>
            {s.classes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s.classes.map((c) => (
                  <span key={c.name} className="rounded-full bg-navy/5 px-3 py-1 text-xs text-navy/70">
                    {c.name} · {c.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}