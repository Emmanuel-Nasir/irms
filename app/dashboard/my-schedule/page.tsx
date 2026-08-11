"use client";

import { useEffect, useState } from "react";
import QrScanner from "@/app/components/QrScanner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type StudentData = {
  user: { name: string };
  stake: string | null;
  graduationProgress: {
    coreCreditsCompleted: number; coreCreditsRequired: number;
    electiveCreditsCompleted: number; electiveCreditsRequired: number;
  } | null;
  enrollments: {
    id: string;
    class: { id: string; name: string; dayOfWeek: number | null; startTime: string | null; venue: string | null; semester: { name: string } };
  }[];
  attendanceRecords: { id: string; date: string; status: string; class: { name: string } }[];
};

type AnnouncementItem = { id: string; title: string; body: string; createdAt: string };

export default function MySchedulePage() {
  const [data, setData] = useState<StudentData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    fetch("/api/students/me")
      .then((res) => res.json())
      .then(setData);
  }, []);

 useEffect(() => {
  if (!data || data.enrollments.length === 0) return;
  const classId = data.enrollments[0].class.id;
  const params = new URLSearchParams({ classId });
  if (data.stake) params.set("stake", data.stake);
  fetch(`/api/announcements?${params.toString()}`)
    .then((res) => res.json())
    .then(setAnnouncements);
}, [data]);

  if (!data) {
    return <div className="min-h-screen bg-parchment p-8 text-navy/50">Loading...</div>;
  }

  const gp = data.graduationProgress;
  const corePct = gp ? Math.min(100, Math.round((gp.coreCreditsCompleted / gp.coreCreditsRequired) * 100)) : 0;
  const electivePct = gp ? Math.min(100, Math.round((gp.electiveCreditsCompleted / gp.electiveCreditsRequired) * 100)) : 0;

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-2 font-display text-2xl text-navy">Welcome, {data.user.name}</h1>
      <p className="mb-8 text-navy/60">Here's what's happening this semester.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-lg border-t-4 border-gold bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-display text-lg text-navy">Check In to Class</h2>
            {scanning ? (
              <QrScanner onClose={() => setScanning(false)} />
            ) : (
              <button
                onClick={() => setScanning(true)}
                className="rounded bg-navy px-6 py-3 font-medium text-parchment transition-all hover:bg-gold hover:text-navy"
              >
                Scan QR Code
              </button>
            )}
            <p className="mt-2 text-xs text-navy/40">Point your camera at the QR your teacher is displaying.</p>
          </div>

          <div className="rounded-lg border-t-4 border-gold bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-display text-lg text-navy">My Schedule</h2>
            {data.enrollments.length === 0 ? (
              <p className="text-sm text-navy/40">Not enrolled in any classes yet.</p>
            ) : (
              <div className="space-y-2">
                {data.enrollments.map((en) => (
                  <div key={en.id} className="rounded border border-navy/10 px-4 py-3">
                    <p className="font-medium text-navy">{en.class.name}</p>
                    <p className="text-sm text-navy/60">
                      {en.class.semester.name}
                      {en.class.dayOfWeek !== null && ` · ${DAYS[en.class.dayOfWeek]}`}
                      {en.class.startTime && ` ${en.class.startTime}`}
                      {en.class.venue && ` · ${en.class.venue}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border-t-4 border-gold bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-display text-lg text-navy">Announcements</h2>
            {announcements.length === 0 ? (
              <p className="text-sm text-navy/40">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="border-b border-navy/10 pb-3 last:border-0">
                    <p className="font-medium text-navy">{a.title}</p>
                    <p className="text-sm text-navy/60">{a.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border-t-4 border-gold bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg text-navy">Graduation Progress</h2>

            <p className="mb-1 text-sm text-navy/60">Core credits</p>
            <div className="mb-1 h-3 w-full overflow-hidden rounded-full bg-navy/10">
              <div className="h-full rounded-full bg-sage transition-all duration-700" style={{ width: `${corePct}%` }} />
            </div>
            <p className="mb-4 text-xs text-navy/50">{gp?.coreCreditsCompleted ?? 0} of {gp?.coreCreditsRequired ?? 2}</p>

            <p className="mb-1 text-sm text-navy/60">Elective credits</p>
            <div className="mb-1 h-3 w-full overflow-hidden rounded-full bg-navy/10">
              <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${electivePct}%` }} />
            </div>
            <p className="text-xs text-navy/50">{gp?.electiveCreditsCompleted ?? 0} of {gp?.electiveCreditsRequired ?? 2}</p>
          </div>

          <div className="rounded-lg border-t-4 border-gold bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-display text-lg text-navy">Recent Attendance</h2>
            {data.attendanceRecords.length === 0 ? (
              <p className="text-sm text-navy/40">No attendance recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {data.attendanceRecords.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-navy">{a.class.name}</span>
                    <span className="rounded-full bg-sage/15 px-2 py-0.5 text-xs font-semibold uppercase text-sage">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}