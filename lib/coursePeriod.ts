import { prisma } from "@/lib/prisma";
import { addDays, dayKey, daysBetween, todayKey } from "@/lib/dates";
import { weekday } from "@/lib/stats";

export type PeriodSource = {
  dayOfWeek: number | null;
  startDate: Date | null;
  endDate: Date | null;
  semester: { startDate: Date; endDate: Date };
};

export type CourseProgress = {
  startKey: string;
  endKey: string;
  lengthDays: number;
  totalClasses: number | null; // null when the class has no weekday set
  classesSoFar: number | null; // scheduled classes up to and including today
  classesLeft: number | null;
  nextClass: string | null; // "YYYY-MM-DD"
  status: "upcoming" | "running" | "finished";
  // Attendance (for one student): over the class days actually held so far
  attended: number;
  heldDays: number;
  percent: number | null;
};

// The course's own dates, or the semester's when none are set
export function periodOf(c: PeriodSource) {
  const startKey = dayKey(c.startDate ?? c.semester.startDate);
  const endKey = dayKey(c.endDate ?? c.semester.endDate);
  return endKey < startKey ? { startKey, endKey: startKey } : { startKey, endKey };
}

// Every date the class meets, from start to end
export function classDates(startKey: string, endKey: string, dow: number | null): string[] {
  if (dow === null) return [];
  const out: string[] = [];
  let k = startKey;
  const first = (dow - weekday(k) + 7) % 7;
  k = addDays(k, first);
  while (k <= endKey && out.length < 400) {
    out.push(k);
    k = addDays(k, 7);
  }
  return out;
}

function daysInclusive(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;
}

/**
 * Where each course stands, and (with studentId) that student's attendance in it.
 * Attendance % counts only days the class actually met (attendance was taken),
 * so a cancelled class doesn't count against anyone. Excused days don't count either.
 */
export async function courseProgress(
  classes: (PeriodSource & { id: string })[],
  studentId?: string
): Promise<Record<string, CourseProgress>> {
  const today = todayKey();
  const result: Record<string, CourseProgress> = {};
  if (classes.length === 0) return result;

  const periods = new Map(classes.map((c) => [c.id, periodOf(c)]));
  const earliest = [...periods.values()].reduce((m, p) => (p.startKey < m ? p.startKey : m), today);
  const ids = classes.map((c) => c.id);

  const [sessions, records] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { classId: { in: ids }, date: daysBetween(earliest, today) },
      select: { classId: true, date: true },
      distinct: ["classId", "date"],
    }),
    studentId
      ? prisma.attendance.findMany({
          where: { classId: { in: ids }, studentId, date: daysBetween(earliest, today) },
          select: { classId: true, date: true, status: true },
        })
      : Promise.resolve([] as { classId: string; date: Date; status: string }[]),
  ]);

  for (const c of classes) {
    const { startKey, endKey } = periods.get(c.id)!;
    const inPeriod = (k: string) => k >= startKey && k <= endKey && k <= today;

    const held = new Set<string>();
    for (const s of sessions) if (s.classId === c.id && inPeriod(dayKey(s.date))) held.add(dayKey(s.date));
    let attended = 0;
    let excused = 0;
    for (const r of records) {
      if (r.classId !== c.id) continue;
      const k = dayKey(r.date);
      if (!inPeriod(k)) continue;
      held.add(k); // a teacher may mark by hand without starting a QR session
      if (r.status === "PRESENT" || r.status === "LATE") attended++;
      if (r.status === "EXCUSED") excused++;
    }
    const counted = held.size - excused;

    const dates = classDates(startKey, endKey, c.dayOfWeek);
    const soFar = dates.filter((d) => d <= today).length;
    result[c.id] = {
      startKey,
      endKey,
      lengthDays: daysInclusive(startKey, endKey),
      totalClasses: c.dayOfWeek === null ? null : dates.length,
      classesSoFar: c.dayOfWeek === null ? null : soFar,
      classesLeft: c.dayOfWeek === null ? null : dates.length - soFar,
      nextClass: dates.find((d) => d >= today) ?? null,
      status: today < startKey ? "upcoming" : today > endKey ? "finished" : "running",
      attended,
      heldDays: held.size,
      percent: counted > 0 ? Math.min(100, Math.round((attended / counted) * 100)) : null,
    };
  }
  return result;
}
