import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS } from "@/lib/permissions";
import { startOfToday, todayKey, dayRange } from "@/lib/dates";
import { audit } from "@/lib/audit";

const MARKS = ["PRESENT", "LATE", "EXCUSED", "ABSENT"] as const;
type Mark = (typeof MARKS)[number];

async function guard(classId: string | null) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return { error: auth.response };
  if (!classId) return { error: NextResponse.json({ error: "classId is required" }, { status: 400 }) };
  if (!(await canManageClass(auth.user, classId))) {
    return { error: NextResponse.json({ error: "This isn't your class" }, { status: 403 }) };
  }
  return { user: auth.user, classId };
}

// Everyone enrolled in the class, with today's mark (if any). Students with no
// record count as absent, which matches how the attendance export counts them.
export async function GET(req: NextRequest) {
  const g = await guard(req.nextUrl.searchParams.get("classId"));
  if ("error" in g) return g.error;

  const [enrollments, records] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: g.classId, status: { not: "DROPPED" } },
      include: { student: { include: { user: { select: { name: true } } } } },
    }),
    prisma.attendance.findMany({
      where: { classId: g.classId, date: dayRange(todayKey()) },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const nameOf = new Map(enrollments.map((e) => [e.studentId, e.student.user.name]));
  const recordOf = new Map(records.map((r) => [r.studentId, r]));

  // The same phone checking in more than one student is worth a second look
  const studentsByDevice = new Map<string, string[]>();
  for (const r of records) {
    if (!r.deviceId) continue;
    studentsByDevice.set(r.deviceId, [...(studentsByDevice.get(r.deviceId) ?? []), r.studentId]);
  }

  const students = enrollments
    .map((e) => {
      const r = recordOf.get(e.studentId);
      const sharedWith =
        r?.deviceId
          ? (studentsByDevice.get(r.deviceId) ?? [])
              .filter((id) => id !== e.studentId)
              .map((id) => nameOf.get(id) ?? "another student")
          : [];
      return {
        studentId: e.studentId,
        name: e.student.user.name,
        status: (r?.status ?? null) as Mark | null,
        markedByTeacher: !!r?.verifiedById,
        checkedInAt: r ? r.createdAt.toISOString() : null,
        sharedWith,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const count = (s: Mark) => students.filter((x) => x.status === s).length;
  return NextResponse.json({
    students,
    total: students.length,
    present: count("PRESENT"),
    late: count("LATE"),
    excused: count("EXCUSED"),
  });
}

// A teacher marks one student by hand: for students without a phone, or whose phone
// couldn't check in. "ABSENT" clears today's record.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const g = await guard(typeof body.classId === "string" ? body.classId : null);
  if ("error" in g) return g.error;

  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const status = body.status as Mark;
  if (!studentId || !MARKS.includes(status)) {
    return NextResponse.json({ error: "Pick a student and a mark" }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId: g.classId } },
  });
  if (!enrollment || enrollment.status === "DROPPED") {
    return NextResponse.json({ error: "That student isn't enrolled in this class" }, { status: 404 });
  }

  const existing = await prisma.attendance.findFirst({
    where: { studentId, classId: g.classId, date: dayRange(todayKey()) },
  });

  const [student, cls] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { user: { select: { name: true } } } }),
    prisma.class.findUnique({ where: { id: g.classId }, select: { name: true } }),
  ]);
  await audit(
    g.user,
    "ATTENDANCE_MARKED",
    `${g.user.name} marked ${student?.user.name ?? "a student"} ${status.toLowerCase()} in ${cls?.name ?? "a class"}`,
    studentId
  );

  if (status === "ABSENT") {
    if (existing) await prisma.attendance.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  }

  if (existing) {
    await prisma.attendance.update({
      where: { id: existing.id },
      data: { status, verifiedById: g.user.id },
    });
  } else {
    await prisma.attendance.create({
      data: { studentId, classId: g.classId, date: startOfToday(), status, verifiedById: g.user.id },
    });
  }
  return NextResponse.json({ success: true });
}
