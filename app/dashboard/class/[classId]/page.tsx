"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BookOpen, CalendarDays, CheckCircle2, Clock, Eye, EyeOff, FileText, Film, Image as ImageIcon, Link2, MapPin,
  Megaphone, Music, NotebookPen, Paperclip, Plus, QrCode, Sparkles, Trash2, Upload, User, Users, X,
} from "lucide-react";
import { AnimatedBackground, CountUp, Meter, ProgressRing } from "@/app/components/Motion";
import { Reveal, Tilt, Waves } from "@/app/components/Alive";
import ErrorScreen from "@/app/components/ErrorScreen";

type Hub = {
  id: string;
  name: string;
  category: string;
  dayOfWeek: number | null;
  startTime: string | null;
  venue: string | null;
  semester: string;
  teacher: string | null;
  canEdit: boolean;
  isStudent: boolean;
  counts: { students: number; plans: number; materials: number; announcements: number };
  nextLesson: { id: string; title: string; date: string | null; scriptures: string | null; status: string } | null;
  rate: { percent: number | null; attended: number; expected: number; classDays: number };
  roster: { id: string; name: string; email: string; attended: number; percent: number | null }[];
  course?: {
    startKey: string;
    endKey: string;
    totalClasses: number | null;
    classesSoFar: number | null;
    status: "upcoming" | "running" | "finished";
    attended: number;
    heldDays: number;
    percent: number | null;
  };
};
type Plan = {
  id: string;
  title: string;
  date: string | null;
  scriptures: string | null;
  objectives: string | null;
  activities?: string | null;
  notes?: string | null;
  status: "DRAFT" | "READY" | "TAUGHT";
  shared: boolean;
};
type Material = {
  id: string;
  title: string;
  description: string | null;
  kind: "LINK" | "FILE";
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
};
type Post = { id: string; title: string; body: string; createdAt: string; author: { name: string }; mine: boolean };
type Tab = "overview" | "lessons" | "materials" | "announcements" | "students";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STATUS_STYLE = {
  DRAFT: "bg-navy/10 text-navy/70",
  READY: "bg-gold/25 text-navy",
  TAUGHT: "bg-sage/15 text-sage",
};
const EMPTY_PLAN = { title: "", date: "", scriptures: "", objectives: "", activities: "", notes: "", shared: false };

function dayLabel(iso: string | null) {
  if (!iso) return "No date yet";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}
function dateInput(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(iso));
}
function size(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function materialIcon(m: Material) {
  if (m.kind === "LINK") return /youtu/.test(m.fileUrl) ? Film : Link2;
  if (m.mimeType?.startsWith("image/")) return ImageIcon;
  if (m.mimeType?.startsWith("audio/")) return Music;
  return FileText;
}
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ClassHubPage() {
  const { classId } = useParams() as { classId: string };
  const [hub, setHub] = useState<Hub | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [toast, setToast] = useState("");

  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const [matTitle, setMatTitle] = useState("");
  const [matDesc, setMatDesc] = useState("");
  const [matLink, setMatLink] = useState("");
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matMode, setMatMode] = useState<"file" | "link">("file");

  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [busy, setBusy] = useState(false);

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 2800);
  }

  const loadHub = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}/hub`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setHub(data);
    else setError(data.error ?? "This class couldn't be opened");
  }, [classId]);
  const loadPlans = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}/plans`);
    if (res.ok) setPlans(await res.json());
  }, [classId]);
  const loadMaterials = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}/materials`);
    if (res.ok) setMaterials(await res.json());
  }, [classId]);
  const loadPosts = useCallback(async () => {
    const res = await fetch(`/api/announcements?classId=${classId}`);
    if (res.ok) setPosts(await res.json());
  }, [classId]);

  useEffect(() => {
    loadHub();
    loadPlans();
    loadMaterials();
    loadPosts();
  }, [loadHub, loadPlans, loadMaterials, loadPosts]);

  // Opened from a sidebar quick action: go straight to the right tab (and form)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab");
    if (t === "lessons" || t === "materials" || t === "announcements" || t === "students") setTab(t);
    if (t === "lessons" && p.get("new") === "1") setShowPlanForm(true);
  }, []);

  async function send(url: string, method: string, body?: unknown) {
    setError("");
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return null;
    }
    return data;
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...planForm, date: planForm.date || null };
    const ok = editingPlan
      ? await send(`/api/plans/${editingPlan}`, "PATCH", body)
      : await send(`/api/classes/${classId}/plans`, "POST", body);
    if (!ok) return;
    flash(editingPlan ? "Lesson plan updated" : "Lesson plan added");
    setPlanForm(EMPTY_PLAN);
    setEditingPlan(null);
    setShowPlanForm(false);
    loadPlans();
    loadHub();
  }

  function startEdit(p: Plan) {
    setPlanForm({
      title: p.title,
      date: dateInput(p.date),
      scriptures: p.scriptures ?? "",
      objectives: p.objectives ?? "",
      activities: p.activities ?? "",
      notes: p.notes ?? "",
      shared: p.shared,
    });
    setEditingPlan(p.id);
    setShowPlanForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function patchPlan(p: Plan, changes: Partial<Plan>, message: string) {
    if (await send(`/api/plans/${p.id}`, "PATCH", changes)) {
      flash(message);
      loadPlans();
      loadHub();
    }
  }

  async function deletePlan(p: Plan) {
    if (!window.confirm(`Delete the lesson plan "${p.title}"?`)) return;
    if (await send(`/api/plans/${p.id}`, "DELETE")) {
      flash("Lesson plan deleted");
      loadPlans();
      loadHub();
    }
  }

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set("title", matTitle);
    form.set("description", matDesc);
    if (matMode === "file" && matFile) form.set("file", matFile);
    if (matMode === "link") form.set("link", matLink);
    if (matMode === "file" && matFile && matFile.size > 4 * 1024 * 1024) {
      setError("That file is over 4 MB. Share a Google Drive link instead.");
      return;
    }
    if (!(await send(`/api/classes/${classId}/materials`, "POST", form))) return;
    flash("Material added");
    setMatTitle("");
    setMatDesc("");
    setMatLink("");
    setMatFile(null);
    loadMaterials();
    loadHub();
  }

  async function removeMaterial(m: Material) {
    if (!window.confirm(`Remove "${m.title}"?`)) return;
    if (await send(`/api/materials/${m.id}`, "DELETE")) {
      flash("Material removed");
      loadMaterials();
      loadHub();
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!(await send("/api/announcements", "POST", { title: postTitle, body: postBody, classId }))) return;
    flash("Announcement posted");
    setPostTitle("");
    setPostBody("");
    loadPosts();
    loadHub();
  }

  async function removePost(p: Post) {
    if (!window.confirm(`Remove "${p.title}"?`)) return;
    if (await send(`/api/announcements/${p.id}`, "DELETE")) {
      flash("Announcement removed");
      loadPosts();
      loadHub();
    }
  }

  if (error && !hub) {
    return (
      <ErrorScreen
        full={false}
        code="403"
        title="You can't open this class"
        message={`${error}. Only the class's teacher, leaders and enrolled students can see it.`}
      />
    );
  }
  if (!hub) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment">
        <BookOpen className="irms-bob text-navy/30" size={48} />
      </div>
    );
  }

  const edit = hub.canEdit;
  const tabs: { id: Tab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "lessons", label: "Lessons", icon: NotebookPen, count: hub.counts.plans },
    { id: "materials", label: "Materials", icon: Paperclip, count: hub.counts.materials },
    { id: "announcements", label: "Announcements", icon: Megaphone, count: hub.counts.announcements },
    ...(edit ? [{ id: "students" as Tab, label: "Students", icon: Users, count: hub.counts.students }] : []),
  ];
  const field = "w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold";
  const primary =
    "irms-shine inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-parchment shadow-md hover:bg-gold hover:text-navy disabled:opacity-50";
  const card = "rounded-2xl border border-navy/10 bg-white/90 p-5 shadow-sm";

  return (
    <div className="min-h-screen bg-parchment pb-16">
      {toast && (
        <div className="irms-toast fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-2xl">
          ✓ {toast}
        </div>
      )}

      {/* Class banner */}
      <section className="irms-gradient-pan relative overflow-hidden bg-gradient-to-br from-navy via-navy-light to-navy px-4 pb-20 pt-8 text-parchment sm:px-8">
        <AnimatedBackground tone="dark" fixed={false} />
        <div className="relative z-10 mx-auto max-w-6xl">
          <p className="irms-enter-left text-xs uppercase tracking-[0.25em] text-gold">
            {hub.semester} · {hub.category.replace(/_/g, " ").toLowerCase()}
          </p>
          <h1 className="irms-enter-left mt-2 font-display text-3xl sm:text-5xl" style={{ animationDelay: "0.1s" }}>
            {hub.name}
          </h1>
          <div className="irms-enter-left mt-4 flex flex-wrap gap-2 text-sm" style={{ animationDelay: "0.2s" }}>
            {hub.dayOfWeek !== null && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                <CalendarDays size={14} /> {DAYS[hub.dayOfWeek]}s
              </span>
            )}
            {hub.startTime && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                <Clock size={14} /> {hub.startTime}
              </span>
            )}
            {hub.venue && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
                <MapPin size={14} /> {hub.venue}
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
              <User size={14} /> {hub.teacher ?? "No teacher yet"}
            </span>
            {hub.course && (
              <span className="flex items-center gap-1.5 rounded-full bg-gold/90 px-3 py-1 font-medium text-navy">
                <CalendarDays size={14} />
                {hub.course.totalClasses === null
                  ? `${dayLabel(hub.course.startKey + "T12:00:00Z")} – ${dayLabel(hub.course.endKey + "T12:00:00Z")}`
                  : hub.course.status === "upcoming"
                  ? `${hub.course.totalClasses} classes · starts ${dayLabel(hub.course.startKey + "T12:00:00Z")}`
                  : hub.course.status === "finished"
                  ? `All ${hub.course.totalClasses} classes done`
                  : `Class ${hub.course.classesSoFar} of ${hub.course.totalClasses}`}
              </span>
            )}
          </div>
          <div className="irms-enter-up mt-6 flex flex-wrap gap-3" style={{ animationDelay: "0.3s" }}>
            {edit ? (
              <Link href={`/dashboard/attendance/${hub.id}`} className="irms-glow flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy shadow-lg hover:scale-105">
                <QrCode size={16} /> Take attendance
              </Link>
            ) : (
              <Link href="/dashboard/my-schedule" className="irms-glow flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy shadow-lg hover:scale-105">
                <QrCode size={16} /> Scan to check in
              </Link>
            )}
          </div>
        </div>
        <Waves />
      </section>

      <div className="relative z-10 mx-auto -mt-12 max-w-6xl px-4 sm:px-8">
        {/* Quick numbers */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Students", value: hub.counts.students, icon: Users },
            { label: edit ? "Lesson plans" : "Lessons shared", value: hub.counts.plans, icon: NotebookPen },
            { label: "Materials", value: hub.counts.materials, icon: Paperclip },
            { label: "Announcements", value: hub.counts.announcements, icon: Megaphone },
          ].map((s, i) => (
            <Tilt key={s.label} className="irms-bounce-in rounded-2xl" >
              <div className="irms-glow-border rounded-2xl" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="rounded-2xl bg-white p-4">
                  <s.icon className="mb-2 text-gold" size={20} />
                  <p className="font-display text-3xl text-navy">
                    <CountUp value={s.value} />
                  </p>
                  <p className="text-xs text-navy/55">{s.label}</p>
                </div>
              </div>
            </Tilt>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-white/80 p-1.5 shadow-sm backdrop-blur" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setError("");
              }}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                tab === t.id ? "bg-navy text-parchment shadow-lg" : "text-navy/70 hover:bg-parchment hover:text-navy"
              }`}
            >
              <t.icon size={16} />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? "bg-gold text-navy" : "bg-navy/10"}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div key="overview" className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Reveal from="left">
              <div className={card}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                  <NotebookPen size={20} className="text-gold" /> Next lesson
                </h2>
                {hub.nextLesson ? (
                  <div className="rounded-xl bg-gradient-to-br from-parchment to-white p-5 ring-1 ring-gold/30">
                    <p className="text-xs uppercase tracking-wider text-gold">{dayLabel(hub.nextLesson.date)}</p>
                    <p className="mt-1 font-display text-2xl text-navy">{hub.nextLesson.title}</p>
                    {hub.nextLesson.scriptures && (
                      <p className="mt-2 flex items-start gap-2 text-sm text-navy/70">
                        <BookOpen size={16} className="mt-0.5 shrink-0 text-gold" /> {hub.nextLesson.scriptures}
                      </p>
                    )}
                    <button onClick={() => setTab("lessons")} className="mt-4 text-sm font-medium text-navy hover:text-gold">
                      See all lessons →
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 text-center">
                    <NotebookPen className="irms-bob text-navy/20" size={44} />
                    <p className="mt-3 text-sm text-navy/55">
                      {edit ? "No upcoming lesson planned yet." : "Your teacher hasn't shared the next lesson yet."}
                    </p>
                    {edit && (
                      <button
                        onClick={() => {
                          setTab("lessons");
                          setShowPlanForm(true);
                        }}
                        className={`${primary} mt-4`}
                      >
                        <Plus size={16} /> Plan a lesson
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Reveal>
            <Reveal from="right" delay={0.1}>
              <div className={`${card} flex flex-col items-center text-center`}>
                <h2 className="mb-4 self-start font-display text-lg text-navy">{hub.isStudent ? "Your attendance" : "Class attendance"}</h2>
                <ProgressRing percent={hub.rate.percent ?? 0} size={140} stroke={12} label="30 days" />
                <p className="mt-4 text-sm text-navy/60">
                  {hub.rate.classDays === 0
                    ? "No class days in the last 30 days yet."
                    : hub.isStudent
                    ? `You came to ${hub.rate.attended} of ${hub.rate.classDays} classes.`
                    : `${hub.rate.attended} check-ins over ${hub.rate.classDays} class day${hub.rate.classDays !== 1 ? "s" : ""}.`}
                </p>
              </div>
            </Reveal>
            <Reveal className="lg:col-span-2" delay={0.15}>
              <div className={card}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-lg text-navy">
                    <Megaphone size={20} className="text-gold" /> Latest from the class
                  </h2>
                  <button onClick={() => setTab("announcements")} className="text-sm font-medium text-navy hover:text-gold">
                    All →
                  </button>
                </div>
                {posts.length === 0 && materials.length === 0 ? (
                  <p className="py-4 text-center text-sm text-navy/50">Nothing posted yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {[
                      ...posts.slice(0, 3).map((p) => ({ id: p.id, at: p.createdAt, icon: Megaphone, text: p.title, sub: p.author.name })),
                      ...materials.slice(0, 3).map((m) => ({ id: m.id, at: m.createdAt, icon: materialIcon(m), text: m.title, sub: "New material" })),
                    ]
                      .sort((a, b) => b.at.localeCompare(a.at))
                      .slice(0, 5)
                      .map((x) => (
                        <li key={x.id} className="irms-enter-left flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-parchment">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy/5 text-navy">
                            <x.icon size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-navy">{x.text}</span>
                            <span className="text-xs text-navy/50">{x.sub}</span>
                          </span>
                          <span className="text-xs text-navy/40">{ago(x.at)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </Reveal>
          </div>
        )}

        {/* LESSONS */}
        {tab === "lessons" && (
          <div key="lessons">
            {edit && (
              <div className="mb-5">
                {!showPlanForm ? (
                  <button onClick={() => setShowPlanForm(true)} className={primary}>
                    <Plus size={16} /> Plan a lesson
                  </button>
                ) : (
                  <form onSubmit={savePlan} className="irms-enter-down rounded-2xl border-t-4 border-gold bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-display text-lg text-navy">{editingPlan ? "Edit lesson plan" : "New lesson plan"}</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPlanForm(false);
                          setEditingPlan(null);
                          setPlanForm(EMPTY_PLAN);
                        }}
                        className="text-navy/50 hover:text-navy"
                        aria-label="Close"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                      <input placeholder="Lesson title (e.g. Faith in Jesus Christ)" value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} className={field} required />
                      <input type="date" value={planForm.date} onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })} className={field} />
                    </div>
                    <input placeholder="Scriptures to read (e.g. Alma 32:21-43; Ether 12:6)" value={planForm.scriptures} onChange={(e) => setPlanForm({ ...planForm, scriptures: e.target.value })} className={`${field} mt-3`} />
                    <textarea placeholder="Objectives: what students should understand or do" rows={3} value={planForm.objectives} onChange={(e) => setPlanForm({ ...planForm, objectives: e.target.value })} className={`${field} mt-3`} />
                    <textarea placeholder="Activities and flow: discussion questions, videos, group work..." rows={4} value={planForm.activities} onChange={(e) => setPlanForm({ ...planForm, activities: e.target.value })} className={`${field} mt-3`} />
                    <textarea placeholder="Private notes (only teachers and leaders see these)" rows={2} value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} className={`${field} mt-3`} />
                    <label className="mt-3 flex items-center gap-2 text-sm text-navy">
                      <input type="checkbox" checked={planForm.shared} onChange={(e) => setPlanForm({ ...planForm, shared: e.target.checked })} />
                      Share title, scriptures and objectives with students once it&apos;s ready
                    </label>
                    <button type="submit" disabled={busy} className={`${primary} mt-4`}>
                      {busy ? "Saving..." : editingPlan ? "Save changes" : "Add lesson plan"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {plans.length === 0 ? (
              <div className={`${card} flex flex-col items-center py-10 text-center`}>
                <NotebookPen className="irms-bob text-navy/20" size={48} />
                <p className="mt-3 text-sm text-navy/55">{edit ? "No lessons planned yet." : "No lessons shared yet."}</p>
              </div>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-gold/40 pl-6">
                {plans.map((p, i) => (
                  <li key={p.id} className="relative">
                    <span
                      className={`absolute -left-[33px] top-5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-parchment ${
                        p.status === "TAUGHT" ? "bg-sage" : p.status === "READY" ? "bg-gold" : "bg-navy/30"
                      }`}
                    >
                      {p.status === "READY" && <span className="irms-ping absolute h-4 w-4 rounded-full bg-gold" />}
                    </span>
                    <Reveal delay={Math.min(i, 6) * 0.05}>
                      <div className={card}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-navy/50">{dayLabel(p.date)}</p>
                            <button onClick={() => setOpenPlan(openPlan === p.id ? null : p.id)} className="text-left font-display text-xl text-navy hover:text-gold">
                              {p.title}
                            </button>
                            {p.scriptures && (
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-navy/65">
                                <BookOpen size={14} className="text-gold" /> {p.scriptures}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[p.status]}`}>
                              {p.status === "DRAFT" ? "Draft" : p.status === "READY" ? "Ready" : "Taught"}
                            </span>
                            {edit && (
                              <span title={p.shared ? "Students can see it" : "Only you can see it"} className={p.shared ? "text-sage" : "text-navy/30"}>
                                {p.shared ? <Eye size={16} /> : <EyeOff size={16} />}
                              </span>
                            )}
                          </div>
                        </div>

                        {openPlan === p.id && (
                          <div className="irms-enter-down mt-4 space-y-3 border-t border-navy/5 pt-4 text-sm">
                            {p.objectives && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy/50">Objectives</p>
                                <p className="whitespace-pre-line text-navy/80">{p.objectives}</p>
                              </div>
                            )}
                            {p.activities && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy/50">Activities</p>
                                <p className="whitespace-pre-line text-navy/80">{p.activities}</p>
                              </div>
                            )}
                            {p.notes && (
                              <div className="rounded-lg bg-gold/10 p-3">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy/50">Private notes</p>
                                <p className="whitespace-pre-line text-navy/80">{p.notes}</p>
                              </div>
                            )}
                            {!p.objectives && !p.activities && !p.notes && <p className="text-navy/50">No details added.</p>}
                          </div>
                        )}

                        {edit && (
                          <div className="mt-4 flex flex-wrap gap-1 border-t border-navy/5 pt-3">
                            {p.status !== "READY" && (
                              <button onClick={() => patchPlan(p, { status: "READY" }, "Marked ready")} className="rounded-md px-2 py-1 text-xs font-medium text-navy/70 hover:bg-gold/15 hover:text-navy">
                                Mark ready
                              </button>
                            )}
                            {p.status !== "TAUGHT" && (
                              <button onClick={() => patchPlan(p, { status: "TAUGHT" }, "Marked taught")} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy/70 hover:bg-sage/15 hover:text-sage">
                                <CheckCircle2 size={13} /> Mark taught
                              </button>
                            )}
                            <button onClick={() => patchPlan(p, { shared: !p.shared }, p.shared ? "Hidden from students" : "Shared with students")} className="rounded-md px-2 py-1 text-xs font-medium text-navy/70 hover:bg-parchment hover:text-navy">
                              {p.shared ? "Hide from students" : "Share with students"}
                            </button>
                            <button onClick={() => startEdit(p)} className="rounded-md px-2 py-1 text-xs font-medium text-navy/70 hover:bg-parchment hover:text-navy">
                              Edit
                            </button>
                            <button onClick={() => deletePlan(p)} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-clay hover:bg-clay/10">
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* MATERIALS */}
        {tab === "materials" && (
          <div key="materials">
            {edit && (
              <form onSubmit={addMaterial} className="irms-enter-down mb-6 rounded-2xl border-t-4 border-gold bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-display text-lg text-navy">Add material</h3>
                <div className="mb-3 inline-flex rounded-lg bg-parchment p-1">
                  {(["file", "link"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMatMode(m)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${matMode === m ? "bg-navy text-parchment" : "text-navy/70"}`}>
                      {m === "file" ? <Upload size={14} /> : <Link2 size={14} />}
                      {m === "file" ? "Upload a file" : "Share a link"}
                    </button>
                  ))}
                </div>
                <input placeholder="Title (e.g. Week 3 handout)" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} className={field} required />
                <input placeholder="Short description (optional)" value={matDesc} onChange={(e) => setMatDesc(e.target.value)} className={`${field} mt-3`} />
                {matMode === "file" ? (
                  <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-navy/20 bg-parchment/50 px-4 py-6 text-center transition-colors hover:border-gold hover:bg-gold/5">
                    <Upload className="irms-bob mb-2 text-gold" size={28} />
                    <span className="text-sm font-medium text-navy">{matFile ? matFile.name : "Tap to choose a file"}</span>
                    <span className="mt-1 text-xs text-navy/50">
                      {matFile ? size(matFile.size) : "PDF, Word, PowerPoint, Excel, images or audio, up to 4 MB"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.mp3,.m4a"
                      onChange={(e) => setMatFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : (
                  <input placeholder="https://drive.google.com/... or https://youtube.com/..." value={matLink} onChange={(e) => setMatLink(e.target.value)} className={`${field} mt-3`} />
                )}
                <button type="submit" disabled={busy || (matMode === "file" ? !matFile : !matLink)} className={`${primary} mt-4`}>
                  {busy ? "Uploading..." : "Add material"}
                </button>
              </form>
            )}

            {materials.length === 0 ? (
              <div className={`${card} flex flex-col items-center py-10 text-center`}>
                <Paperclip className="irms-bob text-navy/20" size={48} />
                <p className="mt-3 text-sm text-navy/55">No materials yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {materials.map((m, i) => {
                  const Icon = materialIcon(m);
                  return (
                    <Reveal key={m.id} delay={Math.min(i, 8) * 0.05}>
                      <Tilt className="h-full rounded-2xl">
                        <div className="flex h-full flex-col rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-navy-light text-gold shadow-md">
                            <Icon size={22} />
                          </span>
                          <p className="font-medium text-navy">{m.title}</p>
                          {m.description && <p className="mt-1 text-sm text-navy/60">{m.description}</p>}
                          <p className="mt-2 text-xs text-navy/45">
                            {m.kind === "FILE" ? `${m.fileName} · ${size(m.size)}` : new URL(m.fileUrl).hostname} · {ago(m.createdAt)}
                          </p>
                          <div className="mt-auto flex items-center gap-2 pt-4">
                            <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={`${primary} flex-1`}>
                              {m.kind === "FILE" ? "Open" : "Open link"}
                            </a>
                            {edit && (
                              <button onClick={() => removeMaterial(m)} className="rounded-lg p-2 text-clay hover:bg-clay/10" aria-label={`Remove ${m.title}`}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </Tilt>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {tab === "announcements" && (
          <div key="announcements" className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {edit && (
              <form onSubmit={post} className="irms-enter-down self-start rounded-2xl border-t-4 border-gold bg-white p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 font-display text-lg text-navy">
                  <Megaphone size={18} className="text-gold" /> Post to this class
                </h3>
                <input placeholder="Title" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className={field} required />
                <textarea placeholder="Message to your students" rows={5} value={postBody} onChange={(e) => setPostBody(e.target.value)} className={`${field} mt-3`} required />
                <button type="submit" disabled={busy} className={`${primary} mt-3 w-full`}>
                  {busy ? "Posting..." : "Post announcement"}
                </button>
              </form>
            )}
            <div className={edit ? "" : "lg:col-span-2"}>
              {posts.length === 0 ? (
                <div className={`${card} flex flex-col items-center py-10 text-center`}>
                  <Megaphone className="irms-bob text-navy/20" size={48} />
                  <p className="mt-3 text-sm text-navy/55">No announcements yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((p, i) => (
                    <Reveal key={p.id} from="right" delay={Math.min(i, 6) * 0.05}>
                      <div className="rounded-2xl border-l-4 border-gold bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-display text-lg text-navy">{p.title}</p>
                          {(p.mine || edit) && (
                            <button onClick={() => removePost(p)} className="text-navy/30 hover:text-clay" aria-label="Remove">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-line text-sm text-navy/75">{p.body}</p>
                        <p className="mt-3 text-xs text-navy/45">
                          {p.author.name} · {ago(p.createdAt)}
                        </p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STUDENTS */}
        {tab === "students" && edit && (
          <div key="students" className={card}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg text-navy">Students and attendance (30 days)</h2>
              <Link href={`/dashboard/attendance/${hub.id}`} className={primary}>
                <QrCode size={16} /> Take attendance
              </Link>
            </div>
            {hub.roster.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy/50">No students enrolled yet.</p>
            ) : (
              <ul className="divide-y divide-navy/5">
                {hub.roster.map((s, i) => (
                  <li key={s.id} className="irms-enter-left flex items-center gap-3 py-3" style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-light font-display text-sm text-parchment">
                      {s.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">{s.name}</p>
                      <div className="mt-1 max-w-xs">
                        <Meter
                          percent={s.percent ?? 0}
                          color={s.percent === null ? "bg-navy/20" : s.percent >= 75 ? "bg-sage" : s.percent >= 50 ? "bg-gold" : "bg-clay"}
                          delay={Math.min(i, 10) * 0.04}
                        />
                      </div>
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-navy/60">
                      {s.percent === null ? "No classes yet" : `${s.attended} of ${hub.rate.classDays} · ${s.percent}%`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
