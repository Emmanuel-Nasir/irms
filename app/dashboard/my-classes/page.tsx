"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClassItem = {
  id: string;
  name: string;
  category: string;
  dayOfWeek: number | null;
  startTime: string | null;
  venue: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MyClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    fetch("/api/classes/mine")
      .then((res) => res.json())
      .then(setClasses);
  }, []);

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-8 font-display text-2xl text-navy">My Classes</h1>

      {classes.length === 0 ? (
        <p className="text-navy/50">No classes assigned to you yet — ask your coordinator.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <div
              key={c.id}
              className="rounded border border-navy/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
            >
              <p className="font-display text-lg text-navy">{c.name}</p>
              <p className="mt-1 text-sm text-navy/60">
                {c.category}
                {c.dayOfWeek !== null && ` · ${DAYS[c.dayOfWeek]}`}
                {c.startTime && ` ${c.startTime}`}
                {c.venue && ` · ${c.venue}`}
              </p>
              <Link
                href={`/dashboard/attendance/${c.id}`}
                className="mt-4 inline-block rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy"
              >
                Take Attendance
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}