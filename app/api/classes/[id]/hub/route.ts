import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole } from "@/lib/permissions";
import { classAccess } from "@/lib/classAccess";
import { addDays, daysBetween, todayKey, startOfToday } from "@/lib/dates";
import { attendanceRate } from "@/lib/stats";
import { courseProgress } from "@/lib/coursePeriod";

// Everything the class page needs at the top: details, what you may do, and quick numbers
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const access = await classAccess(auth.user, id);
  if (!access.canView) return NextResponse.json({ error: "You can't open this class" }, { status: 403 });

  const cls = await prisma.class.findUnique({
    where: { id },
    include: { semester: true, teacher: { include: { user: { select: { name: true } } } } },
  });
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const today = todayKey();
  const [students, plans, materials, announcements, nextLesson, rate] = await Promise.all([
    prisma.enrollment.count({ where: { classId: id, status: { not: "DROPPED" } } }),
    prisma.lessonPlan.count({ where: { classId: id, ...(access.canEdit ? {} : { shared: true }) } }),
    prisma.resource.count({ where: { classId: id } }),
    prisma.announcement.count({ where: { classId: id } }),
    prisma.lessonPlan.findFirst({
      where: {
        classId: id,
        status: { not: "TAUGHT" },
        ...(access.canEdit ? {} : { shared: true, status: "READY" }),
        OR: [{ date: null }, { date: { gte: startOfToday() } }],
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, date: true, scriptures: true, status: true },
    }),
    attendanceRate({ classIds: [id], fromKey: addDays(today, -29), toKey: today, studentId: access.studentId ?? undefined }),
  ]);

  // For the teacher: each student's attendance over the last 30 days
  let roster: { id: string; name: string; email: string; attended: number; percent: number | null }[] = [];
  if (access.canEdit) {
    const [enrolled, records] = await Promise.all([
      prisma.enrollment.findMany({
        where: { classId: id, status: { not: "DROPPED" } },
        include: { student: { include: { user: { select: { name: true, email: true } } } } },
      }),
      prisma.attendance.groupBy({
        by: ["studentId"],
        where: { classId: id, date: daysBetween(addDays(today, -29), today), status: { in: ["PRESENT", "LATE"] } },
        _count: { _all: true },
      }),
    ]);
    const attended = new Map(records.map((r) => [r.studentId, r._count._all]));
    roster = enrolled
      .map((e) => {
        const n = attended.get(e.studentId) ?? 0;
        return {
          id: e.studentId,
          name: e.student.user.name,
          email: e.student.user.email,
          attended: n,
          percent: rate.classDays ? Math.min(100, Math.round((n / rate.classDays) * 100)) : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const course = (await courseProgress([cls], access.studentId ?? undefined))[cls.id];

  return NextResponse.json({
    course,
    roster,
    id: cls.id,
    name: cls.name,
    category: cls.category,
    dayOfWeek: cls.dayOfWeek,
    startTime: cls.startTime,
    venue: cls.venue,
    semester: cls.semester.name,
    teacher: cls.teacher?.user.name ?? null,
    canEdit: access.canEdit,
    isStudent: !!access.studentId,
    counts: { students, plans, materials, announcements },
    nextLesson,
    rate,
  });
}
