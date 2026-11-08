"use client";

import { useEffect, useState } from "react";

type ClassItem = { id: string; name: string; semester: { name: string } };

type AttendanceRow = {
  name: string; email: string; ward: string; stake: string;
  cells: string[]; present: number; late: number; excused: number; absent: number; percent: string;
};
type AttendanceData = { className: string; dates: string[]; rows: AttendanceRow[] };

type RosterRow = {
  name: string; email: string; ward: string; stake: string; phone: string;
  classes: string; core: string; elective: string;
};

const CELL_STYLE: Record<string, string> = {
  P: "bg-sage/15 text-sage",
  L: "bg-gold/25 text-navy",
  E: "bg-navy/10 text-navy/60",
  A: "bg-clay/15 text-clay",
};

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

function shortDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // The leading \uFEFF makes Excel read accented names correctly
  const csv = "\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const [tab, setTab] = useState<"attendance" | "roster">("attendance");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [stakes, setStakes] = useState<string[]>([]);
  const [classId, setClassId] = useState("");
  const [stake, setStake] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFrom(daysAgo(6));
    setTo(daysAgo(0));
    fetch("/api/classes")
      .then((res) => res.json())
      .then((d) => setClasses(Array.isArray(d) ? d : []));
    fetch("/api/students")
      .then((res) => res.json())
      .then((d: { stake: string | null }[]) => {
        if (!Array.isArray(d)) return;
        setStakes(Array.from(new Set(d.map((s) => s.stake).filter(Boolean))) as string[]);
      });
  }, []);

  // Attendance: reload whenever a filter changes
  useEffect(() => {
    if (tab !== "attendance" || !classId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ classId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (stake) params.set("stake", stake);
    fetch(`/api/export/attendance?${params.toString()}`).then(async (res) => {
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Could not load the data");
        setAttendance(null);
      } else {
        setAttendance(data);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, classId, from, to, stake]);

  // Roster: reload whenever a filter changes
  useEffect(() => {
    if (tab !== "roster") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (stake) params.set("stake", stake);
    fetch(`/api/export/students?${params.toString()}`).then(async (res) => {
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Could not load the data");
        setRoster([]);
      } else {
        setRoster(data.rows);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, classId, stake]);

  const q = search.trim().toLowerCase();
  const attRows = (attendance?.rows ?? []).filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q));
  const rosterRows = roster.filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q));

  function quickRange(days: number | null) {
    if (days === null) { setFrom(""); setTo(""); return; }
    setFrom(daysAgo(days - 1));
    setTo(daysAgo(0));
  }

  function download() {
    if (tab === "attendance" && attendance) {
      const header = ["Name", "Email", "Ward", "Stake", ...attendance.dates, "Present", "Late", "Excused", "Absent", "Attendance %"];
      const body = attRows.map((r) => [
        r.name, r.email, r.ward, r.stake, ...r.cells,
        String(r.present), String(r.late), String(r.excused), String(r.absent), r.percent,
      ]);
      const slug = attendance.className.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const first = attendance.dates[0];
      const last = attendance.dates[attendance.dates.length - 1];
      downloadCsv(`attendance-${slug}-${first}-to-${last}.csv`, [header, ...body]);
    } else if (tab === "roster") {
      const header = ["Name", "Email", "Ward", "Stake", "Phone", "Classes", "Core Credits", "Elective Credits"];
      const body = rosterRows.map((r) => [r.name, r.email, r.ward, r.stake, r.phone, r.classes, r.core, r.elective]);
      downloadCsv("student-roster.csv", [header, ...body]);
    }
  }

  const canDownload =
    tab === "attendance"
      ? !!attendance && attendance.dates.length > 0 && attRows.length > 0
      : rosterRows.length > 0;

  const input = "rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold";
  const label = "mb-1 block text-xs font-medium text-navy/70";

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="mb-1 font-display text-2xl text-navy">Export Data</h1>
      <p className="mb-6 text-sm text-navy/60">Filter, check the data on screen, then download exactly what you see.</p>

      <div className="mb-5 flex gap-2">
        {(["attendance", "roster"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-navy text-parchment" : "bg-white text-navy hover:text-gold"
            }`}>
            {t === "attendance" ? "Attendance" : "Student Roster"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded border-t-4 border-gold bg-white p-4 shadow-sm">
        <div>
          <label className={label}>Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={input}>
            <option value="">{tab === "attendance" ? "Select a class" : "All classes"}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.semester.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>Stake</label>
          <select value={stake} onChange={(e) => setStake(e.target.value)} className={input}>
            <option value="">All stakes</option>
            {stakes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {tab === "attendance" && (
          <>
            <div>
              <label className={label}>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
            </div>
            <div className="flex gap-3 pb-2 text-xs">
              <button type="button" onClick={() => quickRange(7)} className="text-navy hover:underline">Last 7 days</button>
              <button type="button" onClick={() => quickRange(30)} className="text-navy hover:underline">Last 30 days</button>
              <button type="button" onClick={() => quickRange(null)} className="text-navy hover:underline">All time</button>
            </div>
          </>
        )}

        <div className="min-w-[160px] grow">
          <label className={label}>Search</label>
          <input placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)}
            className={`${input} w-full`} />
        </div>

        <button onClick={download} disabled={!canDownload}
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-40">
          Download CSV
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>
      )}

      {tab === "attendance" && (
        <>
          {!classId ? (
            <p className="py-10 text-center text-sm text-navy/50">Pick a class to see its attendance sheet.</p>
          ) : loading ? (
            <p className="py-10 text-center text-sm text-navy/50">Loading...</p>
          ) : attendance && attendance.dates.length === 0 ? (
            <p className="py-10 text-center text-sm text-navy/50">
              No class days in this period. Try a wider period.
            </p>
          ) : attendance ? (
            <>
              <p className="mb-2 text-sm text-navy/70">
                <b>{attendance.className}</b> · {attRows.length} student{attRows.length !== 1 ? "s" : ""} · {attendance.dates.length} class day{attendance.dates.length !== 1 ? "s" : ""}
              </p>
              <div className="overflow-auto rounded border border-navy/10 bg-white shadow-sm" style={{ maxHeight: "65vh" }}>
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-navy text-parchment">
                    <tr>
                      <th className="sticky left-0 z-20 bg-navy px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Stake</th>
                      {attendance.dates.map((d) => (
                        <th key={d} className="whitespace-nowrap px-2 py-2 text-center">{shortDate(d)}</th>
                      ))}
                      <th className="px-3 py-2 text-center">Present</th>
                      <th className="px-3 py-2 text-center">Late</th>
                      <th className="px-3 py-2 text-center">Absent</th>
                      <th className="px-3 py-2 text-center">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attRows.map((r) => (
                      <tr key={r.email} className="border-t border-navy/10 odd:bg-white even:bg-parchment">
                        <td className="sticky left-0 whitespace-nowrap bg-inherit px-3 py-2 font-medium text-navy">{r.name}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-navy/70">{r.stake}</td>
                        {r.cells.map((c, i) => (
                          <td key={i} className="px-2 py-2 text-center">
                            <span className={`inline-block w-7 rounded py-0.5 text-xs font-semibold ${CELL_STYLE[c] ?? ""}`}>{c}</span>
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">{r.present}</td>
                        <td className="px-3 py-2 text-center">{r.late}</td>
                        <td className="px-3 py-2 text-center">{r.absent}</td>
                        <td className="px-3 py-2 text-center font-semibold text-navy">{r.percent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-navy/50">
                <b>P</b> present · <b>L</b> late · <b>E</b> excused · <b>A</b> absent. Attendance % = (present + late) ÷ (class days − excused).
                A day counts as a class day when attendance was started or at least one student checked in.
                Only currently enrolled students are listed.
              </p>
            </>
          ) : null}
        </>
      )}

      {tab === "roster" && (
        loading ? (
          <p className="py-10 text-center text-sm text-navy/50">Loading...</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-navy/70">{rosterRows.length} student{rosterRows.length !== 1 ? "s" : ""}</p>
            <div className="overflow-auto rounded border border-navy/10 bg-white shadow-sm" style={{ maxHeight: "65vh" }}>
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-navy text-parchment">
                  <tr>
                    {["Name", "Email", "Ward", "Stake", "Phone", "Classes", "Core", "Elective"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rosterRows.map((r) => (
                    <tr key={r.email} className="border-t border-navy/10 odd:bg-white even:bg-parchment">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-navy">{r.name}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-navy/70">{r.email}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.ward}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.stake}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.phone}</td>
                      <td className="px-3 py-2">{r.classes}</td>
                      <td className="px-3 py-2">{r.core}</td>
                      <td className="px-3 py-2">{r.elective}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  );
}