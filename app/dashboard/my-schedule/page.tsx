"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, GraduationCap, MapPin, Megaphone, QrCode, Sparkles, User, X } from "lucide-react";
import QrScanner from "@/app/components/QrScanner";
import { AnimatedBackground, Meter, ProgressRing } from "@/app/components/Motion";
import { Confetti, Reveal, Tilt, Waves } from "@/app/components/Alive";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GRADIENTS = [
  "from-navy via-navy-light to-navy",
  "from-[#2f5d4b] via-sage to-[#2f5d4b]",
  "from-[#7a5d10] via-gold to-[#7a5d10]",
  "from-[#5c2a24] via-clay to-[#5c2a24]",
];

type Progress = {
  startKey: string;
  endKey: string;
  totalClasses: number | null;
  classesSoFar: number | null;
  classesLeft: number | null;
  nextClass: string | null;
  status: "upcoming" | "running" | "finished";
  attended: number;
  heldDays: number;
  percent: number | null;
};
type StudentData = {
  user: { name: string };
  stake: string | null;
  graduationProgress: {
    coreCreditsCompleted: number;
    coreCreditsRequired: number;
    electiveCreditsCompleted: number;
    electiveCreditsRequired: number;
    graduated: boolean;
    graduationDate: string | null;
  } | null;
  enrollments: {
    id: string;
    status: "ACTIVE" | "COMPLETED" | "DROPPED";
    progress?: Progress;
    class: {
      id: string;
      name: string;
      creditType: "CORE" | "ELECTIVE";
      dayOfWeek: number | null;
      startTime: string | null;
      venue: string | null;
      semester: { name: string };
      teacher: { user: { name: string } } | null;
    };
  }[];
  attendanceRecords: { id: string; date: string; status: string; class: { name: string } }[];
};
type AnnouncementItem = { id: string; title: string; body: string; createdAt: string; class: { name: string } | null };

function niceDay(key: string | null) {
  if (!key) return null;
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

const STATUS_PILL: Record<string, string> = {
  PRESENT: "bg-sage/15 text-sage",
  LATE: "bg-gold/25 text-navy",
  EXCUSED: "bg-navy/10 text-navy/70",
  ABSENT: "bg-clay/15 text-clay",
};

export default function MySchedulePage() {
  const [data, setData] = useState<StudentData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [confetti, setConfetti] = useState(0);

  useEffect(() => {
    fetch("/api/students/me")
      .then((res) => res.json())
      .then(setData);
    fetch("/api/announcements")
      .then((res) => (res.ok ? res.json() : []))
      .then((a) => setAnnouncements(Array.isArray(a) ? a.slice(0, 5) : []));
    if (new URLSearchParams(window.location.search).get("scan") === "1") setScanning(true);
    const onQuick = (e: Event) => {
      if (new URLSearchParams((e as CustomEvent<string>).detail).get("scan") === "1") setScanning(true);
    };
    window.addEventListener("irms:quick", onQuick);
    return () => window.removeEventListener("irms:quick", onQuick);
  }, []);

  // A little celebration for graduates, once per visit
  useEffect(() => {
    if (data?.graduationProgress?.graduated) setConfetti(1);
  }, [data]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment">
        <CalendarDays className="irms-bob text-navy/25" size={48} />
      </div>
    );
  }

  const today = new Date().getDay();
  const todays = data.enrollments.filter((e) => e.class.dayOfWeek === today && e.progress?.status !== "finished");
  const gp = data.graduationProgress;
  const corePct = gp ? (gp.coreCreditsCompleted / Math.max(1, gp.coreCreditsRequired)) * 100 : 0;
  const electivePct = gp ? (gp.electiveCreditsCompleted / Math.max(1, gp.electiveCreditsRequired)) * 100 : 0;
  const firstName = data.user.name.split(" ")[0];

  return (
    <div className="min-h-screen bg-parchment pb-12">
      <Confetti fire={confetti} />
      {/* Banner with the big scan button */}
      <section className="irms-gradient-pan relative overflow-hidden bg-gradient-to-br from-navy via-navy-light to-navy px-4 pb-20 pt-8 text-parchment sm:px-8">
        <AnimatedBackground tone="dark" fixed={false} />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="irms-enter-left text-sm text-parchment/70">My Schedule</p>
            <h1 className="irms-enter-left mt-1 font-display text-3xl sm:text-4xl" style={{ animationDelay: "0.1s" }}>
              Hi {firstName} 👋
            </h1>
            <p className="irms-enter-left mt-2 text-sm text-parchment/75" style={{ animationDelay: "0.2s" }}>
              {todays.length > 0
                ? `You have ${todays.map((t) => t.class.name).join(" and ")} today${todays[0].class.startTime ? ` at ${todays[0].class.startTime}` : ""}.`
                : "No class today. Here's how you're doing."}
            </p>
          </div>
          <button
            onClick={() => setScanning(true)}
            className="irms-enter-up irms-glow irms-shine group flex items-center justify-center gap-3 self-start rounded-2xl bg-gold px-6 py-4 font-semibold text-navy shadow-xl transition-transform hover:scale-105 sm:self-auto"
            style={{ animationDelay: "0.25s" }}
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold">
              <span className="irms-pulse-ring absolute inset-0 rounded-xl border-2 border-navy/40" />
              <QrCode size={22} />
            </span>
            Scan to check in
          </button>
        </div>
        <Waves />
      </section>

      <div className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 sm:px-8">
        {scanning && (
          <div className="irms-pop mb-6 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-gold/40">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-lg text-navy">Point your camera at the QR code</p>
              <button onClick={() => setScanning(false)} className="text-navy/40 hover:text-navy" aria-label="Close scanner">
                <X size={20} />
              </button>
            </div>
            <QrScanner onClose={() => setScanning(false)} />
          </div>
        )}

        {/* My classes */}
        <h2 className="mb-3 mt-2 flex items-center gap-2 font-display text-xl text-navy">
          <Sparkles size={20} className="text-gold" /> My classes
        </h2>
        {data.enrollments.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-navy/55 shadow-sm">
            You&apos;re not in any classes yet. Your coordinator will enroll you.
          </p>
        ) : (
          <div className="mb-8 grid gap-5 sm:grid-cols-2">
            {data.enrollments.map((en, i) => {
              const c = en.class;
              const p = en.progress;
              const isToday = c.dayOfWeek === today && p?.status !== "finished";
              const pct = p?.percent ?? null;
              return (
                <Reveal key={en.id} delay={i * 0.06}>
                  <Tilt className="h-full rounded-3xl" max={5}>
                    <div className={`flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-lg ${isToday ? "irms-glow-border" : ""}`}>
                      <div className={`irms-gradient-pan relative bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} p-5 text-parchment`}>
                        <div className="irms-bob absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {isToday && (
                              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                                <span className="relative flex h-2 w-2">
                                  <span className="irms-ping absolute h-2 w-2 rounded-full bg-white" />
                                  <span className="h-2 w-2 rounded-full bg-white" />
                                </span>
                                Today
                              </span>
                            )}
                            {p?.status === "upcoming" && (
                              <span className="mb-1.5 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                                Starts {niceDay(p.startKey)}
                              </span>
                            )}
                            {p?.status === "finished" && (
                              <span className="mb-1.5 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                                Finished
                              </span>
                            )}
                            <p className="font-display text-2xl leading-tight">{c.name}</p>
                            <p className="mt-1 text-xs text-parchment/70">{c.semester.name}</p>
                          </div>
                          <div className="shrink-0 rounded-full bg-parchment p-1">
                            <ProgressRing
                              percent={pct ?? 0}
                              size={72}
                              stroke={7}
                              color={pct === null ? "#C9A227" : pct >= 75 ? "#5B8266" : pct >= 50 ? "#C9A227" : "#B4544A"}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        {/* Class X of Y */}
                        {p && p.totalClasses !== null ? (
                          <div className="mb-4">
                            <div className="mb-1.5 flex items-baseline justify-between text-sm">
                              <span className="font-medium text-navy">
                                {p.status === "upcoming"
                                  ? `${p.totalClasses} classes in this course`
                                  : p.status === "finished"
                                  ? `All ${p.totalClasses} classes done`
                                  : `Class ${p.classesSoFar} of ${p.totalClasses}`}
                              </span>
                              {p.status === "running" && <span className="text-xs text-navy/50">{p.classesLeft} left</span>}
                            </div>
                            <Meter percent={((p.classesSoFar ?? 0) / Math.max(1, p.totalClasses)) * 100} color="bg-gold" delay={i * 0.06} />
                          </div>
                        ) : null}

                        <p className="mb-3 text-sm text-navy/70">
                          {pct === null
                            ? "Your attendance will show here after the first class."
                            : `You've attended ${p!.attended} of ${p!.heldDays} class${p!.heldDays !== 1 ? "es" : ""} so far (${pct}%).`}
                        </p>

                        <div className="space-y-1.5 text-sm text-navy/65">
                          {c.dayOfWeek !== null && (
                            <p className="flex items-center gap-2">
                              <CalendarDays size={15} className="text-gold" />
                              {DAYS[c.dayOfWeek]}s{c.startTime && ` at ${c.startTime}`}
                              {p?.nextClass && p.status !== "finished" && (
                                <span className="text-navy/45">· next {niceDay(p.nextClass)}</span>
                              )}
                            </p>
                          )}
                          {c.venue && (
                            <p className="flex items-center gap-2">
                              <MapPin size={15} className="text-gold" /> {c.venue}
                            </p>
                          )}
                          {c.teacher && (
                            <p className="flex items-center gap-2">
                              <User size={15} className="text-gold" /> {c.teacher.user.name}
                            </p>
                          )}
                        </div>

                        <div className="mt-auto flex gap-2 pt-5">
                          <Link
                            href={`/dashboard/class/${c.id}`}
                            className="irms-shine group flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-medium text-parchment hover:bg-gold hover:text-navy"
                          >
                            Open class <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                          </Link>
                          {isToday && (
                            <button
                              onClick={() => {
                                setScanning(true);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="flex items-center justify-center rounded-xl bg-gold px-3 text-navy hover:scale-105"
                              aria-label={`Check in to ${c.name}`}
                              title="Check in"
                            >
                              <QrCode size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Tilt>
                </Reveal>
              );
            })}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Announcements */}
          <Reveal from="left">
            <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                <Megaphone size={20} className="text-gold" /> Announcements
              </h2>
              {announcements.length === 0 ? (
                <p className="py-6 text-center text-sm text-navy/50">No announcements yet.</p>
              ) : (
                <ul className="space-y-3">
                  {announcements.map((a) => (
                    <li key={a.id} className="rounded-xl border-l-4 border-gold bg-parchment/70 px-4 py-3">
                      <p className="font-medium text-navy">{a.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-navy/65">{a.body}</p>
                      <p className="mt-1 text-xs text-navy/40">
                        {a.class ? `${a.class.name} · ` : ""}
                        {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>

          <div className="space-y-6">
            {/* Graduation */}
            <Reveal from="right">
              <div className={`rounded-2xl border border-navy/10 bg-white p-5 shadow-sm ${gp?.graduated ? "irms-glow-border" : ""}`}>
                <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-navy">
                  <GraduationCap size={20} className="text-gold" /> Graduation
                </h2>
                {gp?.graduated && (
                  <div className="irms-pop mb-4 rounded-xl bg-gradient-to-r from-navy to-navy-light p-4 text-center text-parchment">
                    <p className="text-3xl">🎓</p>
                    <p className="font-display text-lg text-gold">Congratulations, you&apos;ve graduated!</p>
                    {gp.graduationDate && <p className="text-xs text-parchment/70">{new Date(gp.graduationDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>}
                  </div>
                )}
                <div className="flex justify-around">
                  <div className="text-center">
                    <ProgressRing percent={corePct} size={92} label="Core" color="#003057" />
                    <p className="mt-1 text-xs text-navy/55">
                      {gp?.coreCreditsCompleted ?? 0} of {gp?.coreCreditsRequired ?? 2}
                    </p>
                  </div>
                  <div className="text-center">
                    <ProgressRing percent={electivePct} size={92} label="Elective" color="#C9A227" />
                    <p className="mt-1 text-xs text-navy/55">
                      {gp?.electiveCreditsCompleted ?? 0} of {gp?.electiveCreditsRequired ?? 2}
                    </p>
                  </div>
                </div>

                {!gp?.graduated && (
                  <p className="mt-4 rounded-lg bg-parchment px-3 py-2 text-center text-sm text-navy/75">
                    {(() => {
                      const coreLeft = Math.max(0, (gp?.coreCreditsRequired ?? 2) - (gp?.coreCreditsCompleted ?? 0));
                      const elecLeft = Math.max(0, (gp?.electiveCreditsRequired ?? 2) - (gp?.electiveCreditsCompleted ?? 0));
                      if (!coreLeft && !elecLeft) return "🎉 You have every credit you need. Your coordinator will confirm your graduation.";
                      const parts = [];
                      if (coreLeft) parts.push(`${coreLeft} core class${coreLeft !== 1 ? "es" : ""}`);
                      if (elecLeft) parts.push(`${elecLeft} elective${elecLeft !== 1 ? "s" : ""}`);
                      return `Complete ${parts.join(" and ")} more to graduate. Come to at least 75% of a class for it to count.`;
                    })()}
                  </p>
                )}

                {/* Which classes count */}
                {data.enrollments.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {data.enrollments.map((en) => (
                      <li key={en.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                            en.status === "COMPLETED" ? "bg-sage text-white" : "border-2 border-navy/20"
                          }`}
                        >
                          {en.status === "COMPLETED" && "✓"}
                        </span>
                        <span className={`min-w-0 flex-1 truncate ${en.status === "COMPLETED" ? "text-navy" : "text-navy/65"}`}>{en.class.name}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${en.class.creditType === "CORE" ? "bg-navy text-parchment" : "bg-gold/30 text-navy"}`}>
                          {en.class.creditType === "CORE" ? "Core" : "Elective"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>

            {/* Recent attendance */}
            <Reveal from="right" delay={0.08}>
              <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                  <Clock size={20} className="text-gold" /> Recent attendance
                </h2>
                {data.attendanceRecords.length === 0 ? (
                  <p className="py-4 text-center text-sm text-navy/50">No attendance recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.attendanceRecords.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate text-navy">{a.class.name}</span>
                          <span className="text-xs text-navy/45">
                            {new Date(a.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${STATUS_PILL[a.status] ?? ""}`}>
                          {a.status.toLowerCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
