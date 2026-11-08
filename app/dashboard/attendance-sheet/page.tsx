"use client";

import { useEffect, useState } from "react";

type ClassItem = { id: string; name: string; semester: { name: string } };

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toInput(d);
}

export default function AttendanceSheetPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFrom(daysAgo(6));
    setTo(daysAgo(0));
    fetch("/api/classes")
      .then((res) => res.json())
      .then((data) => setClasses(Array.isArray(data) ? data : []));
  }, []);

  function quickRange(days: number) {
    setFrom(daysAgo(days - 1));
    setTo(daysAgo(0));
  }

  async function download() {
    setError("");
    setBusy(true);
    const params = new URLSearchParams({ classId, from, to });
    const res = await fetch(`/api/export/attendance?${params.toString()}`);
    setBusy(false);

    if (!res.ok) {
      setError((await res.json()).error ?? "Download failed");
      return;
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filename = /filename="(.+)"/.exec(disposition)?.[1] ?? "attendance.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = "mb-4 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold";

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-2 font-display text-2xl text-navy">Attendance Sheet</h1>
      <p className="mb-8 text-sm text-navy/60">
        Download a class's attendance for any date range, ready to open in Excel or Google Sheets.
      </p>

      <div className="max-w-md rounded border-t-4 border-gold bg-white p-6 shadow-sm">
        {error && (
          <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-navy/80">Class</label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={field}>
          <option value="">Select a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.semester.name}</option>
          ))}
        </select>

        <div className="mb-2 flex gap-3">
          <div className="w-full">
            <label className="mb-1 block text-sm font-medium text-navy/80">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          </div>
          <div className="w-full">
            <label className="mb-1 block text-sm font-medium text-navy/80">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" />
          </div>
        </div>

        <div className="mb-6 flex gap-4 text-sm">
          <button type="button" onClick={() => quickRange(7)} className="text-navy hover:underline">Last 7 days</button>
          <button type="button" onClick={() => quickRange(30)} className="text-navy hover:underline">Last 30 days</button>
        </div>

        <button onClick={download} disabled={!classId || busy}
          className="w-full rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
          {busy ? "Preparing..." : "Download CSV"}
        </button>
      </div>

      <div className="mt-6 max-w-md text-xs text-navy/50">
        <p className="mb-1"><b>P</b> present · <b>L</b> late · <b>E</b> excused · <b>A</b> absent</p>
        <p>
          Attendance % = (present + late) ÷ (class days − excused). A day counts as a class day when the
          teacher started attendance or at least one student checked in. Only students currently enrolled
          are listed.
        </p>
      </div>
    </div>
  );
}