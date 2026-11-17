import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS, stakeScope } from "@/lib/permissions";
import { dayKey, parseDayKey, daysBetween } from "@/lib/dates";

const CODE: Record<string, string> = { PRESENT: "P", LATE: "L", EXCUSED: "E", ABSENT: "A" };

export async function GET(req: NextRequest) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return auth.response;

  const params = req.nextUrl.searchParams;
  const classId = params.get("classId");
  const stake = stakeScope(auth.user) ?? params.get("stake");

  if (!classId) return NextResponse.json({ error: "Pick a class first" }, { status: 400 });
  if (!(await canManageClass(auth.user, classId))) {
    return NextResponse.json({ error: "This isn't your class" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const dateFilter = daysBetween(parseDayKey(params.get("from")), parseDayKey(params.get("to")));

  const [sessions, records, enrollments] = await Promise.all([
    prisma.attendanceSession.findMany({ where: { classId, date: dateFilter }, select: { date: true } }),
    prisma.attendance.findMany({
      where: { classId, date: dateFilter },
      select: { studentId: true, date: true, status: true },
    }),
    prisma.enrollment.findMany({
      where: {
        classId,
        status: { not: "DROPPED" },
        ...(stake ? { student: { stake: { equals: stake, mode: "insensitive" as const } } } : {}),
      },
      include: { student: { include: { user: { select: { name: true, email: true } } } } },
    }),
  ]);

  // A day counts as a class day if attendance was started or anyone checked in
  const dates = Array.from(
    new Set([...sessions.map((s) => dayKey(s.date)), ...records.map((r) => dayKey(r.date))])
  ).sort();

  const statusByStudentDay = new Map<string, string>();
  for (const r of records) statusByStudentDay.set(`${r.studentId}|${dayKey(r.date)}`, r.status);

  enrollments.sort((a, b) => a.student.user.name.localeCompare(b.student.user.name));

  const rows = enrollments.map((en) => {
    const s = en.student;
    let present = 0, late = 0, excused = 0, absent = 0;

    const cells = dates.map((k) => {
      const status = statusByStudentDay.get(`${s.id}|${k}`) ?? "ABSENT";
      if (status === "PRESENT") present++;
      else if (status === "LATE") late++;
      else if (status === "EXCUSED") excused++;
      else absent++;
      return CODE[status] ?? "A";
    });

    const counted = dates.length - excused;
    const percent = counted > 0 ? `${Math.round(((present + late) / counted) * 100)}%` : "";

    return {
      name: s.user.name,
      email: s.user.email,
      ward: s.ward ?? "",
      stake: s.stake ?? "",
      cells, present, late, excused, absent, percent,
    };
  });

  return NextResponse.json({ className: cls.name, dates, rows });
}