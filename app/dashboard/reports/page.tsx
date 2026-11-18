"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, Download, GraduationCap, School, TrendingUp, Users } from "lucide-react";
import { AnimatedBackground, BarChart, CountUp, Meter, ProgressRing } from "@/app/components/Motion";
import { Reveal } from "@/app/components/Alive";

type Report = {
  scope: string | null;
  semesters: { id: string; name: string; status: string }[];
  semesterId: string | null;
  totals: { students: number; classes: number; enrolled: number; rate: number | null; checkins: number; atRisk: number; ready: number; graduated: number };
  trend: { label: string; from: string; checkins: number; rate: number | null }[];
  byClass: {
    id: string;
    name: string;
    teacher: string | null;
    creditType: string;
    archived: boolean;
    enrolled: number;
    completed: number;
    heldDays: number;
    attended: number;
    rate: number | null;
    atRisk: number;
  }[];
  byStake: { stake: string; students: number; enrolled: number; attended: number; rate: number | null; atRisk: number; graduated: number }[];
  bySemester: { id: string; name: string; status: string; classes: number; enrolled: number; rate: number | null }[];
};

const rateColor = (r: number | null) => (r === null ? "bg-navy/20" : r >= 75 ? "bg-sage" : r >= 50 ? "bg-gold" : "bg-clay");
const rateText = (r: number | null) => (r === null ? "—" : `${r}%`);
// Hex versions of the same colours, for the ring
const ringColor = (r: number | null) => (r === null ? "#C9A227" : r >= 75 ? "#7FB38D" : r >= 50 ? "#C9A227" : "#D9776B");

function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((r) => r.map((v) => {
      const s = v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [semester, setSemester] = useState("active");
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [trendMode, setTrendMode] = useState<"rate" | "checkins">("rate");
  const [sort, setSort] = useState<"rate" | "name" | "enrolled" | "atRisk">("rate");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/reports/overview?semester=${semester}&weeks=${weeks}`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setData(body);
    else setError(body.error ?? "Couldn't load reports");
  }, [semester, weeks]);
  useEffect(() => {
    load();
  }, [load]);

  const classes = useMemo(() => {
    if (!data) return [];
    const list = [...data.byClass];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "enrolled") list.sort((a, b) => b.enrolled - a.enrolled);
    if (sort === "atRisk") list.sort((a, b) => b.atRisk - a.atRisk);
    if (sort === "rate") list.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
    return list;
  }, [data, sort]);

  function exportClasses() {
    if (!data) return;
    downloadCsv("irms-classes.csv", [
      ["Class", "Teacher", "Credit", "Enrolled", "Completed", "Days held", "Check-ins", "Attendance %", "At risk"],
      ...data.byClass.map((c) => [c.name, c.teacher, c.creditType, c.enrolled, c.completed, c.heldDays, c.attended, c.rate, c.atRisk]),
    ]);
  }
  function exportStakes() {
    if (!data) return;
    downloadCsv("irms-stakes.csv", [
      ["Stake", "Students", "Enrollments", "Check-ins", "Attendance %", "At risk", "Graduated"],
      ...data.byStake.map((s) => [s.stake, s.students, s.enrolled, s.attended, s.rate, s.atRisk, s.graduated]),
    ]);
  }
  function exportTrend() {
    if (!data) return;
    downloadCsv("irms-weekly-trend.csv", [["Week starting", "Check-ins", "Attendance %"], ...data.trend.map((t) => [t.from, t.checkins, t.rate])]);
  }

  const card = "rounded-2xl border border-navy/10 bg-white p-5 shadow-sm";
  const pick = "rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-parchment outline-none backdrop-blur [&>option]:text-navy";

  const tiles = data
    ? [
        { label: "Students", value: data.totals.students, icon: Users, tone: "bg-navy/10 text-navy", bar: "border-b-navy" },
        { label: "Classes", value: data.totals.classes, icon: School, tone: "bg-navy/10 text-navy", bar: "border-b-navy-light" },
        { label: "Check-ins", value: data.totals.checkins, icon: CheckCircle2, tone: "bg-sage/15 text-sage", bar: "border-b-sage" },
        { label: "At risk", value: data.totals.atRisk, icon: AlertTriangle, tone: "bg-clay/15 text-clay", bar: "border-b-clay" },
        { label: "Ready to graduate", value: data.totals.ready, icon: TrendingUp, tone: "bg-gold/20 text-navy", bar: "border-b-gold" },
        { label: "Graduated", value: data.totals.graduated, icon: GraduationCap, tone: "bg-sage/15 text-sage", bar: "border-b-sage" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-parchment pb-12">
      <section className="irms-gradient-pan relative overflow-hidden bg-gradient-to-br from-navy via-navy-light to-navy px-4 pb-20 pt-8 text-parchment sm:px-8">
        <AnimatedBackground tone="dark" fixed={false} />
        <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-end gap-6">
          <div className="flex-1">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-gold">
              <BarChart3 size={14} /> Reports & charts
            </p>
            <h1 className="irms-enter-left mt-2 font-display text-3xl sm:text-4xl">How the institute is doing</h1>
            <p className="mt-1 text-sm text-parchment/70">
              {data?.scope ? `Showing ${data.scope} Stake only.` : "Every stake, every class."} Attendance % counts only days a class actually met.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className={pick}>
              <option value="active">Active semester</option>
              <option value="all">All semesters</option>
              {data?.semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={pick}>
              {[4, 8, 12, 26].map((w) => (
                <option key={w} value={w}>Last {w} weeks</option>
              ))}
            </select>
          </div>
          {data && (
            <div className="irms-pop rounded-2xl bg-white/10 p-3 backdrop-blur">
              <ProgressRing tone="dark" percent={data.totals.rate ?? 0} size={110} label={data.totals.rate === null ? "No classes yet" : "Attendance"} color={ringColor(data.totals.rate)} />
            </div>
          )}
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-12 max-w-6xl space-y-6 px-4 sm:px-8">
        {error && <p className="rounded-xl border border-clay/30 bg-white px-4 py-3 text-sm text-clay shadow">{error}</p>}
        {!data && !error && (
          <div className={`${card} flex items-center justify-center py-16`}>
            <BarChart3 className="irms-bob text-navy/25" size={40} />
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {tiles.map((t, i) => (
                <div key={t.label} className={`irms-enter-up rounded-2xl border border-b-4 border-navy/10 ${t.bar} bg-white p-4 shadow-sm transition-transform hover:-translate-y-1`} style={{ animationDelay: `${i * 0.05}s` }}>
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${t.tone}`}><t.icon size={18} /></span>
                  <p className="mt-2 font-display text-2xl text-navy"><CountUp value={t.value} /></p>
                  <p className="text-[11px] uppercase tracking-widest text-navy/50">{t.label}</p>
                </div>
              ))}
            </div>

            <Reveal>
              <div className={card}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-lg text-navy">Week by week</h2>
                  <div className="ml-auto flex rounded-full bg-navy/5 p-1 text-xs">
                    {(["rate", "checkins"] as const).map((m) => (
                      <button key={m} onClick={() => setTrendMode(m)} className={`rounded-full px-3 py-1 transition-colors ${trendMode === m ? "bg-navy text-parchment" : "text-navy/60"}`}>
                        {m === "rate" ? "Attendance %" : "Check-ins"}
                      </button>
                    ))}
                  </div>
                  <button onClick={exportTrend} className="flex items-center gap-1 text-xs text-navy/60 hover:text-gold"><Download size={14} /> CSV</button>
                </div>
                <BarChart
                  key={trendMode + semester + weeks}
                  height={170}
                  showValues
                  highlightLast={false}
                  max={trendMode === "rate" ? 100 : undefined}
                  data={data.trend.map((t, i) =>
                    trendMode === "rate"
                      ? { label: t.label, value: t.rate ?? 0, display: t.rate === null ? "" : `${t.rate}%`, color: t.rate === null ? "bg-navy/10" : rateColor(t.rate) }
                      : { label: t.label, value: t.checkins, display: t.checkins ? String(t.checkins) : "", color: i === data.trend.length - 1 ? "bg-gradient-to-t from-gold to-gold/70" : "bg-gradient-to-t from-navy to-navy-light" }
                  )}
                />
                {trendMode === "rate" ? (
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/55">
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-sage" /> 75% or more</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-gold" /> 50–74%</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-clay" /> Below 50%</span>
                    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-navy/10" /> No class that week</span>
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-navy/50">Each bar is one week, labelled by its first day. The gold bar is this week.</p>
                )}
              </div>
            </Reveal>

            <Reveal>
              <div className={card}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-lg text-navy">Classes</h2>
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="ml-auto rounded border border-navy/20 px-2 py-1 text-xs outline-none focus:border-gold">
                    <option value="rate">Lowest attendance first</option>
                    <option value="atRisk">Most at risk first</option>
                    <option value="enrolled">Biggest first</option>
                    <option value="name">A to Z</option>
                  </select>
                  <button onClick={exportClasses} className="flex items-center gap-1 text-xs text-navy/60 hover:text-gold"><Download size={14} /> CSV</button>
                </div>
                {classes.length === 0 ? (
                  <p className="text-sm text-navy/50">No classes in this view.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-navy/10 text-left text-[11px] uppercase tracking-widest text-navy/45">
                          <th className="py-2 pr-3">Class</th>
                          <th className="py-2 pr-3">Enrolled</th>
                          <th className="py-2 pr-3">Days held</th>
                          <th className="w-48 py-2 pr-3">Attendance</th>
                          <th className="py-2">At risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map((c, i) => (
                          <tr key={c.id} className="border-b border-navy/5 last:border-0 hover:bg-parchment/60">
                            <td className="py-2.5 pr-3">
                              <Link href={`/dashboard/class/${c.id}`} className="font-medium text-navy hover:text-gold">{c.name}</Link>
                              <span className="block text-xs text-navy/45">
                                {c.teacher ?? "No teacher"} · {c.creditType === "CORE" ? "Core" : "Elective"}{c.archived && " · archived"}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-navy/75">{c.enrolled}{c.completed > 0 && <span className="text-xs text-sage"> ({c.completed} done)</span>}</td>
                            <td className="py-2.5 pr-3 text-navy/75">{c.heldDays}</td>
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1"><Meter percent={c.rate ?? 0} color={rateColor(c.rate)} delay={i * 0.03} /></div>
                                <span className="w-10 text-right text-xs font-semibold text-navy/70">{rateText(c.rate)}</span>
                              </div>
                            </td>
                            <td className="py-2.5">
                              {c.atRisk > 0 ? <span className="rounded-full bg-clay/15 px-2 py-0.5 text-xs font-semibold text-clay">{c.atRisk}</span> : <span className="text-xs text-navy/35">0</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Reveal>

            <div className="grid gap-6 lg:grid-cols-2">
              <Reveal from="left">
                <div className={card}>
                  <div className="mb-4 flex items-center">
                    <h2 className="font-display text-lg text-navy">Stakes</h2>
                    <button onClick={exportStakes} className="ml-auto flex items-center gap-1 text-xs text-navy/60 hover:text-gold"><Download size={14} /> CSV</button>
                  </div>
                  {data.byStake.length === 0 ? (
                    <p className="text-sm text-navy/50">No students yet.</p>
                  ) : (
                    <ul className="space-y-4">
                      {data.byStake.map((s, i) => (
                        <li key={s.stake}>
                          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                            <span className="font-medium text-navy">{s.stake}</span>
                            <span className="text-xs text-navy/55">
                              {s.students} students · {rateText(s.rate)}
                              {s.atRisk > 0 && <b className="ml-1 text-clay">· {s.atRisk} at risk</b>}
                              {s.graduated > 0 && <span className="ml-1 text-sage">· {s.graduated} graduated</span>}
                            </span>
                          </div>
                          <Meter percent={s.rate ?? 0} color={rateColor(s.rate)} delay={i * 0.05} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>

              <Reveal from="right" delay={0.05}>
                <div className={card}>
                  <h2 className="mb-4 font-display text-lg text-navy">Semesters side by side</h2>
                  {data.bySemester.length === 0 ? (
                    <p className="text-sm text-navy/50">No semesters yet.</p>
                  ) : (
                    <ul className="space-y-4">
                      {data.bySemester.map((s, i) => (
                        <li key={s.id}>
                          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                            <span className="font-medium text-navy">
                              {s.name}
                              {s.status === "ACTIVE" && <span className="ml-2 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-sage">Active</span>}
                            </span>
                            <span className="text-xs text-navy/55">{s.classes} classes · {s.enrolled} enrollments · {rateText(s.rate)}</span>
                          </div>
                          <Meter percent={s.rate ?? 0} color={rateColor(s.rate)} delay={i * 0.05} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
