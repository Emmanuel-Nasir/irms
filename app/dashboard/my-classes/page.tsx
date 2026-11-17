"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Clock, MapPin, NotebookPen, Paperclip, QrCode } from "lucide-react";
import { Reveal, Tilt } from "@/app/components/Alive";

type ClassItem = {
  id: string;
  name: string;
  category: string;
  dayOfWeek: number | null;
  startTime: string | null;
  venue: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GRADIENTS = [
  "from-navy via-navy-light to-navy",
  "from-[#2f5d4b] via-sage to-[#2f5d4b]",
  "from-[#7a5d10] via-gold to-[#7a5d10]",
  "from-[#5c2a24] via-clay to-[#5c2a24]",
];

export default function MyClassesPage() {
  const [classes, setClasses] = useState<ClassItem[] | null>(null);

  useEffect(() => {
    fetch("/api/classes/mine")
      .then((res) => res.json())
      .then((d) => setClasses(Array.isArray(d) ? d : []));
  }, []);

  const today = new Date().getDay();

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="flex items-center gap-2 font-display text-3xl text-navy">
          <BookOpen className="text-gold" /> My Classes
        </h1>
        <p className="mb-8 text-sm text-navy/60">Open a class to plan lessons, share materials, post announcements and take attendance.</p>

        {classes === null ? (
          <div className="flex justify-center py-16">
            <BookOpen className="irms-bob text-navy/25" size={48} />
          </div>
        ) : classes.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-navy/55 shadow-sm">No classes assigned to you yet. Ask your coordinator.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c, i) => {
              const isToday = c.dayOfWeek === today;
              return (
                <Reveal key={c.id} delay={i * 0.08}>
                  <Tilt className="h-full rounded-3xl">
                    <div className={`flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-lg ${isToday ? "irms-glow-border" : ""}`}>
                      <div className={`irms-gradient-pan relative bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} p-5 text-parchment`}>
                        <div className="irms-bob absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                        <div className="irms-bob absolute -bottom-8 right-10 h-16 w-16 rounded-full bg-white/10" style={{ animationDelay: "-3s" }} />
                        {isToday && (
                          <span className="relative mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                            <span className="relative flex h-2 w-2">
                              <span className="irms-ping absolute h-2 w-2 rounded-full bg-white" />
                              <span className="h-2 w-2 rounded-full bg-white" />
                            </span>
                            Today
                          </span>
                        )}
                        <p className="relative font-display text-2xl">{c.name}</p>
                        <p className="relative mt-1 text-xs uppercase tracking-wider text-parchment/70">{c.category.replace(/_/g, " ").toLowerCase()}</p>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <div className="space-y-1.5 text-sm text-navy/70">
                          {c.dayOfWeek !== null && (
                            <p className="flex items-center gap-2">
                              <CalendarDays size={15} className="text-gold" /> {DAYS[c.dayOfWeek]}s
                            </p>
                          )}
                          {c.startTime && (
                            <p className="flex items-center gap-2">
                              <Clock size={15} className="text-gold" /> {c.startTime}
                            </p>
                          )}
                          {c.venue && (
                            <p className="flex items-center gap-2">
                              <MapPin size={15} className="text-gold" /> {c.venue}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 flex gap-2 text-xs text-navy/50">
                          <span className="flex items-center gap-1"><NotebookPen size={13} /> Lessons</span>
                          <span className="flex items-center gap-1"><Paperclip size={13} /> Materials</span>
                        </div>
                        <div className="mt-auto flex gap-2 pt-5">
                          <Link
                            href={`/dashboard/class/${c.id}`}
                            className="irms-shine group flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-medium text-parchment hover:bg-gold hover:text-navy"
                          >
                            Open class <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                          </Link>
                          <Link
                            href={`/dashboard/attendance/${c.id}`}
                            className="flex items-center justify-center rounded-xl border border-navy/15 px-3 text-navy hover:border-gold hover:text-gold"
                            aria-label={`Take attendance for ${c.name}`}
                            title="Take attendance"
                          >
                            <QrCode size={18} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Tilt>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
