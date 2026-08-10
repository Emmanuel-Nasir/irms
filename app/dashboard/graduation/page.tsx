"use client";

import { useEffect, useState } from "react";

type StudentItem = {
  id: string;
  user: { name: string };
  graduationProgress: {
    coreCreditsCompleted: number; coreCreditsRequired: number;
    electiveCreditsCompleted: number; electiveCreditsRequired: number;
  } | null;
};

export default function GraduationPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);

  async function load() {
    const res = await fetch("/api/students");
    setStudents(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function updateField(studentId: string, field: string, value: number, current: StudentItem) {
    const gp = current.graduationProgress;
    const body = {
      coreCreditsCompleted: gp?.coreCreditsCompleted ?? 0,
      coreCreditsRequired: gp?.coreCreditsRequired ?? 2,
      electiveCreditsCompleted: gp?.electiveCreditsCompleted ?? 0,
      electiveCreditsRequired: gp?.electiveCreditsRequired ?? 2,
      [field]: value,
    };
    await fetch(`/api/graduation/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-8 font-display text-2xl text-navy">Graduation Progress</h1>

      <div className="space-y-4">
        {students.map((s) => {
          const gp = s.graduationProgress;
          return (
            <div key={s.id} className="rounded border border-navy/10 bg-white p-5 shadow-sm">
              <p className="mb-3 font-medium text-navy">{s.user.name}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="mb-1 text-navy/60">Core credits</p>
                  <div className="flex items-center gap-2">
                    <input type="number" defaultValue={gp?.coreCreditsCompleted ?? 0}
                      onBlur={(e) => updateField(s.id, "coreCreditsCompleted", Number(e.target.value), s)}
                      className="w-16 rounded border border-navy/20 px-2 py-1" />
                    <span>/</span>
                    <input type="number" defaultValue={gp?.coreCreditsRequired ?? 2}
                      onBlur={(e) => updateField(s.id, "coreCreditsRequired", Number(e.target.value), s)}
                      className="w-16 rounded border border-navy/20 px-2 py-1" />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-navy/60">Elective credits</p>
                  <div className="flex items-center gap-2">
                    <input type="number" defaultValue={gp?.electiveCreditsCompleted ?? 0}
                      onBlur={(e) => updateField(s.id, "electiveCreditsCompleted", Number(e.target.value), s)}
                      className="w-16 rounded border border-navy/20 px-2 py-1" />
                    <span>/</span>
                    <input type="number" defaultValue={gp?.electiveCreditsRequired ?? 2}
                      onBlur={(e) => updateField(s.id, "electiveCreditsRequired", Number(e.target.value), s)}
                      className="w-16 rounded border border-navy/20 px-2 py-1" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}