"use client";

import { useEffect, useState } from "react";

type StakeReport = { stake: string; studentCount: number; classes: { name: string; count: number }[] };

export default function ReportsPage() {
  const [data, setData] = useState<StakeReport[]>([]);

  useEffect(() => {
    fetch("/api/reports/stakes").then((res) => res.json()).then(setData);
  }, []);

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-8 font-display text-2xl text-navy">Stake Summary</h1>

      <div className="space-y-4">
        {data.map((s) => (
          <div key={s.stake} className="rounded border-t-4 border-gold bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-display text-lg text-navy">{s.stake}</p>
              <span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-white">
                {s.studentCount} student{s.studentCount !== 1 ? "s" : ""}
              </span>
            </div>
            {s.classes.length === 0 ? (
              <p className="text-sm text-navy/40">No class enrollments yet.</p>
            ) : (
              <div className="space-y-1">
                {s.classes.map((c) => (
                  <div key={c.name} className="flex justify-between text-sm text-navy/70">
                    <span>{c.name}</span>
                    <span>{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}