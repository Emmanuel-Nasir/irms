import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS } from "@/lib/permissions";

const CODE: Record<string, string> = { PRESENT: "P", LATE: "L", EXCUSED: "E", ABSENT: "A" };

// "2026-08-14" -> a Date at the start or end of that day
function parseDay(value: string | null, endOfDay: boolean) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return auth.response;

  const params = req.nextUrl.searchParams;
  const classId = params.get("classId");
  const stake = params.get("stake");

  if (!classId) return NextResponse.json({ error: "Pick a class first" }, { status: 400 });
  if (!(await canManageClass(auth.user, classId))) {
    return NextResponse.json({ error: "This isn't your class" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const from = parseDay(params.get("from"), false);
  const to = parseDay(params.get("to"), true);
  const dateFilter = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

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
        ...(stake ? { student: { stake } } : {}),
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