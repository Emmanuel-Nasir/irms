"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, Clock, FilePlus2, MapPin, NotebookPen, Paperclip, QrCode, Send, X } from "lucide-react";
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

// Sidebar quick actions arrive as ?do=...: pick a class, then go straight to the task
type Action = "attendance" | "plan" | "materials" | "announce";
const ACTIONS: Record<Action, { ask: string; button: string; icon: typeof QrCode; target: (id: string) => string }> = {
  attendance: { ask: "Which class are you taking attendance for?", button: "Take attendance", icon: QrCode, target: (id) => `/dashboard/attendance/${id}` },
  plan: { ask: "Which class is this lesson for?", button: "Plan a lesson", icon: NotebookPen, target: (id) => `/dashboard/class/${id}?tab=lessons&new=1` },
  materials: { ask: "Which class are these materials for?", button: "Share materials", icon: FilePlus2, target: (id) => `/dashboard/class/${id}?tab=materials` },
  announce: { ask: "Which class are you posting to?", button: "Post here", icon: Send, target: (id) => `/dashboard/class/${id}?tab=announcements` },
};
function readAction(search: string): Action | null {
  const d = new URLSearchParams(search).get("do");
  return d && d in ACTIONS ? (d as Action) : null;
}
const GRADIENTS = [
  "from-navy via-navy-light to-navy",
  "from-[#2f5d4b] via-sage to-[#2f5d4b]",
  "from-[#7a5d10] via-gold to-[#7a5d10]",
  "from-[#5c2a24] via-clay to-[#5c2a24]",
];

export default function MyClassesPage() {
  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const router = useRouter();

  useEffect(() => {
    setAction(readAction(window.location.search));
    const onQuick = (e: Event) => setAction(readAction((e as CustomEvent<string>).detail));
    window.addEventListener("irms:quick", onQuick);
    return () => window.removeEventListener("irms:quick", onQuick);
  }, []);

  // Only one class? No need to ask which.
  useEffect(() => {
    if (action && classes?.length === 1) router.replace(ACTIONS[action].target(classes[0].id));
  }, [action, classes, router]);

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

        {action && (
          <div className="irms-enter-down irms-glow mb-6 flex items-center justify-between gap-3 rounded-2xl border-2 border-gold bg-white px-5 py-4 shadow-sm">
            <p className="flex items-center gap-2 font-medium text-navy">
              {(() => {
                const Icon = ACTIONS[action].icon;
                return <Icon size={20} className="text-gold" />;
              })()}
              {ACTIONS[action].ask}
            </p>
            <button onClick={() => setAction(null)} className="text-navy/40 hover:text-navy" aria-label="Cancel">
              <X size={18} />
            </button>
          </div>
        )}

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
                            href={action ? ACTIONS[action].target(c.id) : `/dashboard/class/${c.id}`}
                            className={`irms-shine group flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                              action ? "bg-gold text-navy hover:bg-navy hover:text-parchment" : "bg-navy text-parchment hover:bg-gold hover:text-navy"
                            }`}
                          >
                            {action ? ACTIONS[action].button : "Open class"}{" "}
                            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
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
