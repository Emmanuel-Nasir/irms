"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarHeart, Check, ChevronDown, Clock, HelpCircle, MapPin, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { AnimatedBackground } from "@/app/components/Motion";
import { Confetti, Reveal } from "@/app/components/Alive";

type Rsvp = "GOING" | "MAYBE" | "NOT_GOING";
type EventItem = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  date: string;
  semester: string | null;
  semesterId: string | null;
  createdBy: string;
  counts: { going: number; maybe: number; notGoing: number };
  myRsvp: Rsvp | null;
  canEdit: boolean;
  attendees?: { id: string; name: string; ward: string | null; stake: string | null; status: Rsvp }[];
};
type Draft = { title: string; description: string; venue: string; date: string; time: string; semesterId: string };

const EMPTY: Draft = { title: "", description: "", venue: "", date: "", time: "10:00", semesterId: "" };
const TZ = "Africa/Lagos";

// "2026-11-20" and "10:00" in Abeokuta time, for filling the edit form
function parts(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}

function countdown(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return ms > -6 * 3600000 ? "Happening now" : "Finished";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days >= 2) return `In ${days} days`;
  if (days === 1) return `In 1 day${hours ? ` ${hours} h` : ""}`;
  if (hours >= 1) return `In ${hours} h ${mins % 60} min`;
  return `In ${mins} min`;
}

const RSVP_BUTTONS: { value: Rsvp; label: string; icon: typeof Check; on: string }[] = [
  { value: "GOING", label: "Going", icon: Check, on: "bg-sage text-white border-sage" },
  { value: "MAYBE", label: "Maybe", icon: HelpCircle, on: "bg-gold text-navy border-gold" },
  { value: "NOT_GOING", label: "Can't come", icon: X, on: "bg-clay text-white border-clay" },
];
const STATUS_TEXT: Record<Rsvp, string> = { GOING: "Going", MAYBE: "Maybe", NOT_GOING: "Can't come" };

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [canRsvp, setCanRsvp] = useState(false);
  const [past, setPast] = useState(false);
  const [semesters, setSemesters] = useState<{ id: string; name: string; status: string }[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [party, setParty] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events${past ? "?past=1" : ""}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Couldn't load events");
      setEvents([]);
      return;
    }
    setEvents(body.events);
    setCanCreate(body.canCreate);
    setCanRsvp(body.canRsvp);
  }, [past]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!canCreate) return;
    fetch("/api/semesters")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        setSemesters(list);
        const active = list.find((s: { status: string }) => s.status === "ACTIVE");
        if (active) setDraft((d) => (d.semesterId ? d : { ...d, semesterId: active.id }));
      });
  }, [canCreate]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Couldn't save the event");
    setDraft({ ...EMPTY, semesterId: draft.semesterId });
    setParty((p) => p + 1);
    setPast(false);
    load();
  }

  async function saveEdit(id: string) {
    setError("");
    const res = await fetch(`/api/events/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editDraft) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Couldn't save");
    setEditing(null);
    load();
  }

  async function remove(ev: EventItem) {
    if (!confirm(`Cancel "${ev.title}"? Everyone's replies will be removed too.`)) return;
    const res = await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't delete");
    load();
  }

  async function rsvp(ev: EventItem, status: Rsvp) {
    // Show the answer straight away, then confirm with the server
    setEvents((list) => list?.map((x) => (x.id === ev.id ? { ...x, myRsvp: x.myRsvp === status ? null : status } : x)) ?? null);
    const res = await fetch(`/api/events/${ev.id}/rsvp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't save your reply");
    else if (status === "GOING" && ev.myRsvp !== "GOING") setParty((p) => p + 1);
    load();
  }

  const field = "w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold";
  const next = !past && events?.find((e) => new Date(e.date).getTime() > now);

  function formFields(d: Draft, set: (d: Draft) => void) {
    return (
      <>
        <input required placeholder="Event name, e.g. Institute devotional" value={d.title} onChange={(e) => set({ ...d, title: e.target.value })} className={`${field} sm:col-span-2`} />
        <input required type="date" value={d.date} onChange={(e) => set({ ...d, date: e.target.value })} className={field} />
        <input type="time" value={d.time} onChange={(e) => set({ ...d, time: e.target.value })} className={field} />
        <input placeholder="Venue (optional)" value={d.venue} onChange={(e) => set({ ...d, venue: e.target.value })} className={field} />
        <select value={d.semesterId} onChange={(e) => set({ ...d, semesterId: e.target.value })} className={field}>
          <option value="">No semester</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <textarea placeholder="What it's about (optional)" rows={2} value={d.description} onChange={(e) => set({ ...d, description: e.target.value })} className={`${field} sm:col-span-2`} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-parchment pb-12">
      <Confetti fire={party} />
      <section className="irms-gradient-pan relative overflow-hidden bg-gradient-to-br from-navy via-navy-light to-navy px-4 pb-20 pt-8 text-parchment sm:px-8">
        <AnimatedBackground tone="dark" fixed={false} />
        <div className="relative z-10 mx-auto max-w-5xl">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-gold">
            <CalendarHeart size={14} /> Events
          </p>
          <h1 className="irms-enter-left mt-2 font-display text-3xl sm:text-4xl">Gather together</h1>
          <p className="mt-1 max-w-xl text-sm text-parchment/70">
            {canCreate
              ? "Plan devotionals, socials and service projects, and see who's coming."
              : "Devotionals, socials and service projects. Let your leaders know if you're coming."}
          </p>
          {next && (
            <div className="irms-pop mt-5 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <Clock size={18} className="text-gold" />
              <span className="text-sm">
                Next up: <b>{next.title}</b> · <span className="text-gold">{countdown(next.date, now)}</span>
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-12 max-w-5xl space-y-6 px-4 sm:px-8">
        {canCreate && (
          <form onSubmit={create} className="irms-enter-up grid gap-3 rounded-2xl border-t-4 border-gold bg-white p-5 shadow-lg sm:grid-cols-2">
            <h2 className="flex items-center gap-2 font-display text-lg text-navy sm:col-span-2">
              <Plus size={18} className="text-gold" /> Plan an event
            </h2>
            {formFields(draft, setDraft)}
            <button disabled={busy} className="irms-shine rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50 sm:col-span-2 sm:justify-self-start">
              {busy ? "Saving…" : "Add event"}
            </button>
          </form>
        )}

        {error && (
          <p className="flex items-center justify-between rounded-xl border border-clay/30 bg-white px-4 py-3 text-sm text-clay shadow">
            {error}
            <button onClick={() => setError("")}><X size={16} /></button>
          </p>
        )}

        <div className="flex w-fit rounded-full bg-white p-1 text-sm shadow-sm">
          {[false, true].map((p) => (
            <button key={String(p)} onClick={() => setPast(p)} className={`rounded-full px-4 py-1.5 transition-colors ${past === p ? "bg-navy text-parchment" : "text-navy/60 hover:text-navy"}`}>
              {p ? "Past" : "Upcoming"}
            </button>
          ))}
        </div>

        {events === null ? (
          <div className="flex justify-center py-16"><CalendarHeart className="irms-bob text-navy/25" size={40} /></div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy/20 bg-white/60 px-6 py-14 text-center">
            <CalendarHeart className="irms-float mx-auto text-gold" size={40} />
            <p className="mt-3 font-display text-lg text-navy">{past ? "No past events yet" : "Nothing planned yet"}</p>
            <p className="mt-1 text-sm text-navy/55">{canCreate && !past ? "Use the form above to plan the first one." : "Check back soon."}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((ev, i) => {
              const d = new Date(ev.date);
              const isOpen = open === ev.id;
              const upcoming = d.getTime() > now - 6 * 3600000;
              return (
                <Reveal key={ev.id} delay={Math.min(i, 6) * 0.05}>
                  <article className="group flex h-full flex-col rounded-2xl border border-navy/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-gold hover:shadow-lg">
                    {editing === ev.id ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {formFields(editDraft, setEditDraft)}
                        <div className="flex gap-2 sm:col-span-2">
                          <button onClick={() => saveEdit(ev.id)} className="rounded bg-navy px-4 py-2 text-sm text-parchment hover:bg-gold hover:text-navy">Save</button>
                          <button onClick={() => setEditing(null)} className="rounded px-4 py-2 text-sm text-navy/60 hover:text-navy">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-4">
                          <div className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${upcoming ? "bg-gradient-to-b from-navy to-navy-light text-parchment" : "bg-navy/10 text-navy/60"} shadow transition-transform group-hover:scale-105`}>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-gold">
                              {d.toLocaleDateString("en-GB", { month: "short", timeZone: TZ })}
                            </span>
                            <span className="font-display text-2xl leading-none">{d.toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ })}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-lg leading-tight text-navy">{ev.title}</h3>
                            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-navy/60">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {d.toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ })},{" "}
                                {d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: TZ })}
                              </span>
                              {ev.venue && <span className="flex items-center gap-1"><MapPin size={12} /> {ev.venue}</span>}
                            </p>
                            {upcoming && (
                              <span className="mt-2 inline-block rounded-full bg-gold/20 px-2.5 py-0.5 text-[11px] font-semibold text-navy">{countdown(ev.date, now)}</span>
                            )}
                          </div>
                          {ev.canEdit && (
                            <div className="flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                              <button title="Edit" onClick={() => { setEditing(ev.id); setEditDraft({ title: ev.title, description: ev.description ?? "", venue: ev.venue ?? "", semesterId: ev.semesterId ?? "", ...parts(ev.date) }); }} className="rounded p-1.5 text-navy/60 hover:bg-navy/5 hover:text-navy"><Pencil size={15} /></button>
                              <button title="Cancel event" onClick={() => remove(ev)} className="rounded p-1.5 text-navy/60 hover:bg-clay/10 hover:text-clay"><Trash2 size={15} /></button>
                            </div>
                          )}
                        </div>

                        {ev.description && <p className="mt-3 whitespace-pre-line text-sm text-navy/75">{ev.description}</p>}

                        <div className="mt-auto pt-4">
                          <p className="mb-2 flex items-center gap-1.5 text-xs text-navy/55">
                            <Users size={13} /> <b className="text-sage">{ev.counts.going}</b> going · {ev.counts.maybe} maybe
                            {ev.semester && <span className="ml-auto">{ev.semester}</span>}
                          </p>

                          {canRsvp && upcoming && (
                            <div className="flex flex-wrap gap-2">
                              {RSVP_BUTTONS.map((b) => {
                                const on = ev.myRsvp === b.value;
                                return (
                                  <button key={b.value} onClick={() => rsvp(ev, b.value)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${on ? `${b.on} shadow` : "border-navy/15 text-navy/70 hover:border-gold"}`}>
                                    <b.icon size={13} /> {b.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {canRsvp && !upcoming && ev.myRsvp && (
                            <p className="text-xs text-navy/55">You said: {STATUS_TEXT[ev.myRsvp]}</p>
                          )}

                          {ev.attendees !== undefined && (
                            <>
                              <button onClick={() => setOpen(isOpen ? null : ev.id)} className="flex items-center gap-1 text-xs font-medium text-navy hover:text-gold">
                                {isOpen ? "Hide" : "See"} who replied ({ev.attendees.length})
                                <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </button>
                              {isOpen && (
                                <ul className="irms-enter-down mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg bg-parchment p-2 text-sm">
                                  {ev.attendees.length === 0 && <li className="px-2 py-1 text-xs text-navy/50">No replies yet.</li>}
                                  {ev.attendees
                                    .slice()
                                    .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name))
                                    .map((a) => (
                                      <li key={a.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-white">
                                        <Link href={`/dashboard/students/${a.id}`} className="truncate text-navy hover:text-gold">
                                          {a.name}
                                          {a.ward && <span className="text-xs text-navy/45"> · {a.ward}</span>}
                                        </Link>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.status === "GOING" ? "bg-sage/15 text-sage" : a.status === "MAYBE" ? "bg-gold/25 text-navy" : "bg-clay/15 text-clay"}`}>
                                          {STATUS_TEXT[a.status]}
                                        </span>
                                      </li>
                                    ))}
                                </ul>
                              )}
                            </>
                          )}
                          <p className="mt-3 text-[11px] text-navy/35">Planned by {ev.createdBy}</p>
                        </div>
                      </>
                    )}
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
