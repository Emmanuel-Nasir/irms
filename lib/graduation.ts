import { prisma } from "@/lib/prisma";
import { dayKey, daysBetween, todayKey } from "@/lib/dates";
import { classDates, periodOf } from "@/lib/coursePeriod";

// A finished class counts towards graduation when the student came to at least this share of it
export const COMPLETE_AT_PERCENT = 75;
// Below this while a course is running, the student is flagged as "at risk"
export const AT_RISK_BELOW = 50;

export type ClassStanding = {
  enrollmentId: string;
  classId: string;
  name: string;
  creditType: "CORE" | "ELECTIVE";
  enrollment: "ACTIVE" | "COMPLETED" | "DROPPED";
  course: "upcoming" | "running" | "finished";
  totalClasses: number | null;
  classesSoFar: number | null;
  attended: number;
  heldDays: number;
  percent: number | null;
  readyToComplete: boolean; // finished, came often enough, not yet marked complete
  atRisk: boolean;
};

export type StudentStanding = {
  studentId: string;
  name: string;
  email: string;
  stake: string | null;
  ward: string | null;
  core: { done: number; required: number };
  elective: { done: number; required: number };
  graduated: boolean;
  graduationDate: string | null;
  status: "graduated" | "ready" | "on-track" | "at-risk" | "not-started";
  classes: ClassStanding[];
  stillNeeded: string; // plain words: what's left
};

/**
 * Where every student (matching `where`) stands on the way to graduation.
 * Done in a handful of queries, however many students there are.
 */
export async function graduationStandings(where: object = {}): Promise<StudentStanding[]> {
  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      graduationProgress: true,
      enrollments: { include: { class: { include: { semester: true } } } },
    },
    orderBy: { user: { name: "asc" } },
  });
  if (students.length === 0) return [];

  const today = todayKey();
  const classIds = [...new Set(students.flatMap((s) => s.enrollments.map((e) => e.classId)))];
  const periods = new Map<string, { startKey: string; endKey: string }>();
  for (const s of students) for (const e of s.enrollments) periods.set(e.classId, periodOf(e.class));
  const earliest = [...periods.values()].reduce((m, p) => (p.startKey < m ? p.startKey : m), today);

  const [sessions, records] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { classId: { in: classIds }, date: daysBetween(earliest, today) },
      select: { classId: true, date: true },
      distinct: ["classId", "date"],
    }),
    prisma.attendance.findMany({
      where: { classId: { in: classIds }, studentId: { in: students.map((s) => s.id) }, date: daysBetween(earliest, today) },
      select: { classId: true, studentId: true, date: true, status: true },
    }),
  ]);

  // Days each class actually met (attendance started, or anyone marked)
  const heldByClass = new Map<string, Set<string>>();
  const add = (cid: string, k: string) => {
    if (!heldByClass.has(cid)) heldByClass.set(cid, new Set());
    heldByClass.get(cid)!.add(k);
  };
  for (const s of sessions) add(s.classId, dayKey(s.date));
  for (const r of records) add(r.classId, dayKey(r.date));

  return students.map((s) => {
    const classes: ClassStanding[] = s.enrollments.map((e) => {
      const { startKey, endKey } = periods.get(e.classId)!;
      const inPeriod = (k: string) => k >= startKey && k <= endKey && k <= today;
      const held = [...(heldByClass.get(e.classId) ?? [])].filter(inPeriod);
      let attended = 0;
      let excused = 0;
      for (const r of records) {
        if (r.studentId !== s.id || r.classId !== e.classId || !inPeriod(dayKey(r.date))) continue;
        if (r.status === "PRESENT" || r.status === "LATE") attended++;
        if (r.status === "EXCUSED") excused++;
      }
      const counted = held.length - excused;
      const percent = counted > 0 ? Math.min(100, Math.round((attended / counted) * 100)) : null;
      const dates = classDates(startKey, endKey, e.class.dayOfWeek);
      const course = today < startKey ? "upcoming" : today > endKey ? "finished" : "running";
      return {
        enrollmentId: e.id,
        classId: e.classId,
        name: e.class.name,
        creditType: e.class.creditType,
        enrollment: e.status,
        course,
        totalClasses: e.class.dayOfWeek === null ? null : dates.length,
        classesSoFar: e.class.dayOfWeek === null ? null : dates.filter((d) => d <= today).length,
        attended,
        heldDays: held.length,
        percent,
        readyToComplete: e.status === "ACTIVE" && course === "finished" && percent !== null && percent >= COMPLETE_AT_PERCENT,
        atRisk: e.status === "ACTIVE" && course === "running" && percent !== null && percent < AT_RISK_BELOW,
      };
    });

    const gp = s.graduationProgress;
    const core = { done: gp?.coreCreditsCompleted ?? 0, required: gp?.coreCreditsRequired ?? 2 };
    const elective = { done: gp?.electiveCreditsCompleted ?? 0, required: gp?.electiveCreditsRequired ?? 2 };
    const coreLeft = Math.max(0, core.required - core.done);
    const electiveLeft = Math.max(0, elective.required - elective.done);
    const graduated = !!gp?.graduated;

    let status: StudentStanding["status"];
    if (graduated) status = "graduated";
    else if (coreLeft === 0 && electiveLeft === 0) status = "ready";
    else if (classes.some((c) => c.atRisk)) status = "at-risk";
    else if (classes.length === 0 && core.done + elective.done === 0) status = "not-started";
    else status = "on-track";

    const parts = [];
    if (coreLeft) parts.push(`${coreLeft} core class${coreLeft !== 1 ? "es" : ""}`);
    if (electiveLeft) parts.push(`${electiveLeft} elective${electiveLeft !== 1 ? "s" : ""}`);

    return {
      studentId: s.id,
      name: s.user.name,
      email: s.user.email,
      stake: s.stake,
      ward: s.ward,
      core,
      elective,
      graduated,
      graduationDate: gp?.graduationDate ? gp.graduationDate.toISOString() : null,
      status,
      classes,
      stillNeeded: graduated
        ? "Graduated"
        : parts.length
        ? `Needs ${parts.join(" and ")} more`
        : "Has every credit needed: ready to graduate",
    };
  });
}

/** Sets a student's completed credits from the classes they've completed. */
export async function recalculateCredits(studentId: string) {
  const done = await prisma.enrollment.findMany({
    where: { studentId, status: "COMPLETED" },
    select: { class: { select: { creditType: true } } },
  });
  const core = done.filter((d) => d.class.creditType === "CORE").length;
  const elective = done.filter((d) => d.class.creditType === "ELECTIVE").length;
  return prisma.graduationProgress.upsert({
    where: { studentId },
    update: { coreCreditsCompleted: core, electiveCreditsCompleted: elective },
    create: { studentId, coreCreditsCompleted: core, electiveCreditsCompleted: elective },
  });
}
