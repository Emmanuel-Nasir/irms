import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, BookOpen, CalendarCheck, CalendarDays, ClipboardList, Clock, GraduationCap, Library,
  Megaphone, QrCode, School, Sparkles, TrendingUp, UserCheck, Users, type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, dayRange, todayKey } from "@/lib/dates";
import { attendanceRate, dailyCheckins, greeting, longDate, shortDay, weekday } from "@/lib/stats";
import { AnimatedBackground, BarChart, CountUp, Meter, ProgressRing } from "@/app/components/Motion";
import { LiveClock, Reveal, Ticker, Tilt, TypeOut, Waves } from "@/app/components/Alive";

export const dynamic = "force-dynamic";

const STAFF = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  AREA_ADMIN: "Area Admin",
  STAKE_ADMIN: "Stake Admin",
  COORDINATOR: "Coordinator",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

type Stat = { label: string; value: number; suffix?: string; icon: LucideIcon; tone: string; hint?: string };
type TodayClass = {
  id: string;
  name: string;
  time: string | null;
  venue: string | null;
  enrolled: number;
  here: number;
  mine?: "checked-in" | "not-yet";
};
type Feed = { id: string; who: string; what: string; when: Date };
type Action = { label: string; href: string; icon: LucideIcon; hint: string };

function timeAgo(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    select: { name: true, role: true, stake: true, totpEnabledAt: true, mustChangePassword: true, student: true, teacher: true },
  });
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/dashboard/change-password?first=1");

  const today = todayKey();
  const dow = weekday(today);
  const monthAgo = addDays(today, -29);
  const isStaff = STAFF.includes(user.role);
  const isTeacher = user.role === "TEACHER";
  const isStudent = user.role === "STUDENT";

  const activeSemester = await prisma.semester.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select: { name: true },
  });

  // Which classes this person looks after (null = all of them)
  let classIds: string[] | null = null;
  if (isTeacher) {
    const mine = await prisma.class.findMany({
      where: { teacherId: user.teacher?.id ?? "-", archived: false },
      select: { id: true },
    });
    classIds = mine.map((c) => c.id);
  } else if (isStudent) {
    const enrolled = await prisma.enrollment.findMany({
      where: { studentId: user.student?.id ?? "-", status: { not: "DROPPED" } },
      select: { classId: true },
    });
    classIds = enrolled.map((e) => e.classId);
  }
  const classFilter = classIds ? { id: { in: classIds } } : {};
  const studentId = isStudent ? user.student?.id : undefined;

  const [rate, week, todaysClassRows] = await Promise.all([
    attendanceRate({ classIds, fromKey: monthAgo, toKey: today, studentId }),
    dailyCheckins(classIds, 7, studentId),
    prisma.class.findMany({
      where: { ...classFilter, archived: false, dayOfWeek: dow },
      select: { id: true, name: true, startTime: true, venue: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  // Today's classes, with how many are here so far
  const todayIds = todaysClassRows.map((c) => c.id);
  const [enrollCounts, hereRecords] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["classId"],
      where: { classId: { in: todayIds }, status: { not: "DROPPED" } },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: { classId: { in: todayIds }, date: dayRange(today), status: { in: ["PRESENT", "LATE"] } },
      select: { classId: true, studentId: true },
    }),
  ]);
  const todayClasses: TodayClass[] = todaysClassRows.map((c) => ({
    id: c.id,
    name: c.name,
    time: c.startTime,
    venue: c.venue,
    enrolled: enrollCounts.find((e) => e.classId === c.id)?._count._all ?? 0,
    here: hereRecords.filter((r) => r.classId === c.id).length,
    mine: studentId
      ? hereRecords.some((r) => r.classId === c.id && r.studentId === studentId)
        ? "checked-in"
        : "not-yet"
      : undefined,
  }));

  // Recent activity
  const recent = await prisma.attendance.findMany({
    where: {
      ...(classIds ? { classId: { in: classIds } } : {}),
      ...(studentId ? { studentId } : {}),
      status: { in: ["PRESENT", "LATE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { student: { include: { user: { select: { name: true } } } }, class: { select: { name: true } } },
  });
  const feed: Feed[] = recent.map((r) => ({
    id: r.id,
    who: isStudent ? r.class.name : r.student.user.name,
    what: isStudent
      ? `${r.status === "LATE" ? "Late" : "Present"}${r.verifiedById ? " (marked by teacher)" : ""}`
      : `${r.status === "LATE" ? "arrived late to" : "checked in to"} ${r.class.name}`,
    when: r.createdAt,
  }));

  const announcements = await prisma.announcement.findMany({
    where: isStudent
      ? {
          AND: [
            { OR: [{ classId: null }, { classId: { in: classIds ?? [] } }] },
            { OR: [{ targetStake: null }, ...(user.student?.stake ? [{ targetStake: user.student.stake }] : [])] },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, body: true, createdAt: true },
  });

  // The numbers across the top
  let stats: Stat[] = [];
  let actions: Action[] = [];
  let grad: { core: [number, number]; elective: [number, number] } | null = null;

  if (isStaff) {
    // Stake admins and coordinators with a stake only count their own stake's students
    const limited = (user.role === "STAKE_ADMIN" || user.role === "COORDINATOR") && user.stake;
    const [students, teachers, classes, checkinsToday] = await Promise.all([
      prisma.student.count({
        where: { active: true, ...(limited ? { stake: { equals: user.stake!, mode: "insensitive" } } : {}) },
      }),
      prisma.teacher.count(),
      prisma.class.count({ where: { archived: false } }),
      prisma.attendance.count({ where: { date: dayRange(today), status: { in: ["PRESENT", "LATE"] } } }),
    ]);
    stats = [
      { label: "Students", value: students, icon: Users, tone: "from-navy to-navy-light", hint: "active" },
      { label: "Teachers", value: teachers, icon: School, tone: "from-sage to-[#3f6b4c]" },
      { label: "Classes", value: classes, icon: Library, tone: "from-gold to-[#a8861a]" },
      { label: "Checked in today", value: checkinsToday, icon: UserCheck, tone: "from-clay to-[#8f3f36]" },
    ];
    actions = [
      { label: "Students", href: "/dashboard/students", icon: Users, hint: "Register and find students" },
      { label: "Classes", href: "/dashboard/classes", icon: Library, hint: "Create classes, assign teachers" },
      { label: "Enrollments", href: "/dashboard/enrollments", icon: ClipboardList, hint: "Put students in classes" },
      { label: "Announcements", href: "/dashboard/announcements", icon: Megaphone, hint: "Tell everyone what's on" },
      { label: "Reports", href: "/dashboard/reports", icon: TrendingUp, hint: "Attendance by stake" },
      { label: "Graduation", href: "/dashboard/graduation", icon: GraduationCap, hint: "Credits and progress" },
    ];
  } else if (isTeacher) {
    const students = classIds?.length
      ? await prisma.enrollment.count({ where: { classId: { in: classIds }, status: { not: "DROPPED" } } })
      : 0;
    stats = [
      { label: "My classes", value: classIds?.length ?? 0, icon: BookOpen, tone: "from-navy to-navy-light" },
      { label: "My students", value: students, icon: Users, tone: "from-sage to-[#3f6b4c]" },
      { label: "Classes today", value: todayClasses.length, icon: CalendarDays, tone: "from-gold to-[#a8861a]" },
      { label: "Here today", value: hereRecords.length, icon: UserCheck, tone: "from-clay to-[#8f3f36]" },
    ];
    actions = [
      { label: "My Classes", href: "/dashboard/my-classes", icon: BookOpen, hint: "Open a class and take attendance" },
      { label: "Plan a lesson", href: "/dashboard/my-classes", icon: ClipboardList, hint: "Scriptures, objectives, activities" },
      { label: "Share materials", href: "/dashboard/my-classes", icon: Library, hint: "Upload handouts or share links" },
      { label: "Post an announcement", href: "/dashboard/my-classes", icon: Megaphone, hint: "Tell your class what's on" },
      { label: "My Account", href: "/dashboard/change-password", icon: Sparkles, hint: "Email, password, two-step sign-in" },
    ];
  } else if (isStudent) {
    const g = user.student
      ? await prisma.graduationProgress.findUnique({ where: { studentId: user.student.id } })
      : null;
    grad = {
      core: [g?.coreCreditsCompleted ?? 0, g?.coreCreditsRequired ?? 2],
      elective: [g?.electiveCreditsCompleted ?? 0, g?.electiveCreditsRequired ?? 2],
    };
    stats = [
      { label: "My classes", value: classIds?.length ?? 0, icon: BookOpen, tone: "from-navy to-navy-light" },
      { label: "Classes attended", value: rate.attended, icon: CalendarCheck, tone: "from-sage to-[#3f6b4c]", hint: "last 30 days" },
      { label: "Core credits", value: grad.core[0], suffix: ` / ${grad.core[1]}`, icon: GraduationCap, tone: "from-gold to-[#a8861a]" },
      { label: "Elective credits", value: grad.elective[0], suffix: ` / ${grad.elective[1]}`, icon: Sparkles, tone: "from-clay to-[#8f3f36]" },
    ];
    actions = [
      { label: "Scan QR code", href: "/dashboard/my-schedule", icon: QrCode, hint: "Check in to class" },
      { label: "My Schedule", href: "/dashboard/my-schedule", icon: CalendarDays, hint: "Your classes and times" },
    ];
  }

  const firstName = user.name.split(" ")[0];
  const card = "rounded-2xl border border-navy/10 bg-white/85 p-5 shadow-sm backdrop-blur";

  return (
    <div className="min-h-screen bg-parchment px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        {/* Welcome banner */}
        <section className="irms-gradient-pan relative mb-0 overflow-hidden rounded-t-3xl bg-gradient-to-br from-navy via-navy-light to-navy p-6 pb-16 text-parchment shadow-xl sm:p-10 sm:pb-20">
          <AnimatedBackground tone="dark" fixed={false} />
          {/* Floating shapes */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="irms-bob absolute right-[8%] top-6 h-20 w-20 rounded-full border-2 border-gold/40" />
            <div className="irms-bob absolute right-[30%] top-[55%] h-10 w-10 rotate-45 rounded-md bg-gold/20" style={{ animationDelay: "-2s" }} />
            <div className="irms-bob absolute left-[45%] top-4 h-6 w-6 rounded-full bg-sage/40" style={{ animationDelay: "-4s" }} />
            <div className="irms-spin-slow absolute -right-16 -bottom-16 h-56 w-56 rounded-full border border-dashed border-parchment/20" />
          </div>
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="irms-enter-left flex items-center gap-3 text-sm text-parchment/70">
                {longDate(today)}
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-display text-base text-gold backdrop-blur">
                  <LiveClock />
                </span>
              </p>
              <h1 className="irms-enter-left mt-2 min-h-[1.2em] font-display text-3xl sm:text-5xl" style={{ animationDelay: "0.1s" }}>
                <TypeOut text={`${greeting()}, ${firstName}`} />
              </h1>
              <div className="irms-enter-left mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ animationDelay: "0.2s" }}>
                <span className="rounded-full bg-gold px-3 py-1 font-semibold uppercase tracking-wider text-navy">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
                <span className="rounded-full border border-parchment/25 px-3 py-1 text-parchment/85">
                  {activeSemester ? `Semester: ${activeSemester.name}` : "No active semester"}
                </span>
                {todayClasses.length > 0 && (
                  <span className="irms-glow rounded-full border border-gold/50 px-3 py-1 text-gold">
                    {todayClasses.length} class{todayClasses.length !== 1 ? "es" : ""} today
                  </span>
                )}
              </div>
            </div>
            <div className="irms-enter-up flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur" style={{ animationDelay: "0.25s" }}>
              <div className="rounded-full bg-parchment p-1">
                <ProgressRing percent={rate.percent ?? 0} size={92} label="30 days" />
              </div>
              <div className="max-w-[10rem] text-sm">
                <p className="font-medium">{isStudent ? "Your attendance" : "Attendance"}</p>
                <p className="mt-1 text-xs text-parchment/70">
                  {rate.percent === null
                    ? "No class days yet in the last 30 days."
                    : `${rate.attended} of ${rate.expected} expected check-ins over ${rate.classDays} class day${rate.classDays !== 1 ? "s" : ""}.`}
                </p>
              </div>
            </div>
          </div>
          <Waves />
        </section>

        {/* Scrolling ticker under the banner */}
        <div className="relative mb-6 overflow-hidden rounded-b-3xl bg-gradient-to-r from-gold via-[#e0c25a] to-gold py-2.5 text-sm font-medium text-navy shadow-lg">
          <Ticker
            items={[
              ...todayClasses.map((c) => `Today: ${c.name}${c.time ? ` at ${c.time}` : ""}${c.venue ? `, ${c.venue}` : ""}`),
              ...announcements.map((a) => `📣 ${a.title}`),
              activeSemester ? `Semester: ${activeSemester.name}` : "Welcome to IRMS",
              rate.percent !== null ? `Attendance over 30 days: ${rate.percent}%` : "Check in to class with a quick scan",
              "Institute of Religion · Abeokuta Oke-Ata Stake",
            ]}
          />
        </div>

        {user.role === "SUPER_ADMIN" && !user.totpEnabledAt && (
          <Link
            href="/dashboard/change-password"
            className="irms-glow mb-6 flex items-center justify-between gap-4 rounded-2xl border-2 border-clay/40 bg-white p-4 shadow-sm"
          >
            <span className="text-sm text-navy">
              <b className="text-clay">Switch on two-step sign-in.</b> Super admin tools (All Users, Security Centre,
              Activity Log) stay locked until you do.
            </span>
            <ArrowRight className="shrink-0 text-clay" size={18} />
          </Link>
        )}

        {/* Stats */}
        <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Tilt key={s.label} className="irms-bounce-in rounded-2xl">
            <div className="irms-glow-border rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="group relative overflow-hidden rounded-2xl bg-white p-4 sm:p-5">
              <div
                className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${s.tone} opacity-15 transition-transform duration-500 group-hover:scale-150`}
              />
              <span
                className={`relative mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.tone} text-white shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`}
              >
                <s.icon size={20} />
              </span>
              <p className="relative font-display text-3xl text-navy">
                <CountUp value={s.value} suffix={s.suffix} />
              </p>
              <p className="relative text-sm text-navy/60">
                {s.label}
                {s.hint && <span className="text-navy/40"> · {s.hint}</span>}
              </p>
            </div>
            </div>
            </Tilt>
          ))}
        </section>

        <Reveal>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Today's classes */}
          <section className={card}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg text-navy">
                <CalendarDays size={20} className="text-gold" /> Today&apos;s classes
              </h2>
              <span className="text-xs text-navy/50">{shortDay(today)}</span>
            </div>
            {todayClasses.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CalendarDays size={40} className="irms-float text-navy/20" />
                <p className="mt-3 text-sm text-navy/50">No classes scheduled for today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((c) => {
                  const pct = c.enrolled ? Math.round((c.here / c.enrolled) * 100) : 0;
                  return (
                    <div key={c.id} className="rounded-xl border border-navy/10 bg-parchment/60 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-navy">{c.name}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-navy/55">
                            <Clock size={12} /> {c.time ?? "Time not set"}
                            {c.venue && ` · ${c.venue}`}
                          </p>
                        </div>
                        {isStudent ? (
                          c.mine === "checked-in" ? (
                            <span className="rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sage">✓ Checked in</span>
                          ) : (
                            <Link
                              href="/dashboard/my-schedule"
                              className="irms-shine irms-glow flex items-center gap-1.5 rounded-full bg-navy px-4 py-1.5 text-xs font-medium text-parchment hover:bg-gold hover:text-navy"
                            >
                              <QrCode size={14} /> Scan to check in
                            </Link>
                          )
                        ) : (
                          <Link
                            href={`/dashboard/attendance/${c.id}`}
                            className="irms-shine flex items-center gap-1.5 rounded-full bg-navy px-4 py-1.5 text-xs font-medium text-parchment hover:bg-gold hover:text-navy"
                          >
                            Take attendance <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                      {!isStudent && (
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs text-navy/55">
                            <span>
                              {c.here} of {c.enrolled} here
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <Meter percent={pct} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* This week */}
          <section className={card}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg text-navy">
                <TrendingUp size={20} className="text-gold" /> {isStudent ? "Your week" : "Check-ins this week"}
              </h2>
              <span className="text-xs text-navy/50">
                <CountUp value={week.reduce((a, d) => a + d.value, 0)} /> total
              </span>
            </div>
            <BarChart data={week.map((d) => ({ label: shortDay(d.key), value: d.value }))} height={150} />
          </section>
        </div>
        </Reveal>

        {grad && (
          <Reveal from="left">
          <section className={`${card} mt-6`}>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-navy">
              <GraduationCap size={20} className="text-gold" /> Progress towards graduation
            </h2>
            <div className="flex flex-wrap items-center justify-around gap-6">
              <div className="text-center">
                <ProgressRing percent={(grad.core[0] / Math.max(1, grad.core[1])) * 100} size={110} label="Core" color="#003057" />
                <p className="mt-2 text-sm text-navy/60">
                  {grad.core[0]} of {grad.core[1]} core credits
                </p>
              </div>
              <div className="text-center">
                <ProgressRing percent={(grad.elective[0] / Math.max(1, grad.elective[1])) * 100} size={110} label="Elective" color="#C9A227" />
                <p className="mt-2 text-sm text-navy/60">
                  {grad.elective[0]} of {grad.elective[1]} elective credits
                </p>
              </div>
            </div>
          </section>
          </Reveal>
        )}

        <Reveal delay={0.05}>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Activity */}
          <section className={card}>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-navy">
              <UserCheck size={20} className="text-gold" /> {isStudent ? "Your recent attendance" : "Recent check-ins"}
            </h2>
            {feed.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy/50">Nothing yet. Check-ins will appear here.</p>
            ) : (
              <ul className="space-y-2">
                {feed.map((f) => (
                  <li key={f.id} className="irms-enter-left flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-parchment">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-light font-display text-sm text-parchment">
                      {f.who.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-navy">
                        <b className="font-medium">{f.who}</b> <span className="text-navy/60">{f.what}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-navy/40">{timeAgo(f.when)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Announcements */}
          <section className={card}>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-navy">
              <Megaphone size={20} className="irms-wiggle text-gold" /> Announcements
            </h2>
            {announcements.length === 0 ? (
              <p className="py-6 text-center text-sm text-navy/50">No announcements yet.</p>
            ) : (
              <ul className="space-y-3">
                {announcements.map((a) => (
                  <li key={a.id} className="rounded-xl border-l-4 border-gold bg-parchment/70 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-navy">{a.title}</p>
                      <span className="shrink-0 text-xs text-navy/40">{timeAgo(a.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-navy/65">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        </Reveal>

        {/* Shortcuts */}
        {actions.length > 0 && (
          <section className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy/50">Shortcuts</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {actions.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="irms-shine group flex items-center gap-4 rounded-2xl border border-navy/10 bg-white/90 p-4 shadow-sm hover:border-gold"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy transition-all duration-300 group-hover:rotate-6 group-hover:bg-gold group-hover:text-navy">
                    <a.icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-navy">{a.label}</p>
                    <p className="truncate text-xs text-navy/50">{a.hint}</p>
                  </div>
                  <ArrowRight size={18} className="text-navy/30 transition-transform group-hover:translate-x-1 group-hover:text-gold" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
