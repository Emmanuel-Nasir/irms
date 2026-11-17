import { prisma } from "@/lib/prisma";
import { APP_TIME_ZONE, addDays, dayKey, daysBetween, todayKey } from "@/lib/dates";

// Day of the week (0 = Sunday) for a "YYYY-MM-DD" day
export function weekday(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

// The hour right now in the institute's time zone (for "Good morning")
export function hourNow(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
}

export function greeting(): string {
  const h = hourNow();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function longDate(key = todayKey()): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const ATTENDED = new Set(["PRESENT", "LATE"]);

export type Rate = { percent: number | null; attended: number; expected: number; classDays: number };

/**
 * Attendance rate over a period: attended ÷ expected.
 * A class day is a day on which attendance was started or anyone was marked.
 * Expected = everyone enrolled, on every class day of their class. Excused doesn't count against anyone.
 * Pass studentId for one student's own rate.
 */
export async function attendanceRate(opts: {
  classIds: string[] | null;
  fromKey: string;
  toKey: string;
  studentId?: string;
}): Promise<Rate> {
  const { classIds, fromKey, toKey, studentId } = opts;
  if (classIds && classIds.length === 0) return { percent: null, attended: 0, expected: 0, classDays: 0 };

  const classFilter = classIds ? { classId: { in: classIds } } : {};
  const date = daysBetween(fromKey, toKey);

  const [sessions, records, enrollments] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { ...classFilter, date },
      select: { classId: true, date: true },
      distinct: ["classId", "date"],
    }),
    prisma.attendance.findMany({
      where: { ...classFilter, date, ...(studentId ? { studentId } : {}) },
      select: { classId: true, date: true, status: true },
    }),
    prisma.enrollment.groupBy({
      by: ["classId"],
      where: { ...classFilter, status: { not: "DROPPED" }, ...(studentId ? { studentId } : {}) },
      _count: { _all: true },
    }),
  ]);

  const enrolled = new Map(enrollments.map((e) => [e.classId, e._count._all]));
  const days = new Set<string>();
  for (const s of sessions) days.add(`${s.classId}|${dayKey(s.date)}`);
  for (const r of records) days.add(`${r.classId}|${dayKey(r.date)}`);

  let expected = 0;
  for (const d of days) expected += enrolled.get(d.split("|")[0]) ?? 0;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  const attended = records.filter((r) => ATTENDED.has(r.status)).length;
  expected = Math.max(0, expected - excused);

  return {
    percent: expected > 0 ? Math.min(100, Math.round((attended / expected) * 100)) : null,
    attended,
    expected,
    classDays: days.size,
  };
}

/** Check-ins (present or late) on each of the last `days` days, oldest first. */
export async function dailyCheckins(classIds: string[] | null, days = 7, studentId?: string) {
  const today = todayKey();
  const fromKey = addDays(today, -(days - 1));
  if (classIds && classIds.length === 0) {
    return Array.from({ length: days }, (_, i) => ({ key: addDays(fromKey, i), value: 0 }));
  }
  const records = await prisma.attendance.findMany({
    where: {
      ...(classIds ? { classId: { in: classIds } } : {}),
      ...(studentId ? { studentId } : {}),
      date: daysBetween(fromKey, today),
      status: { in: ["PRESENT", "LATE"] },
    },
    select: { date: true },
  });
  const counts = new Map<string, number>();
  for (const r of records) counts.set(dayKey(r.date), (counts.get(dayKey(r.date)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(fromKey, i);
    return { key, value: counts.get(key) ?? 0 };
  });
}

export function shortDay(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}
