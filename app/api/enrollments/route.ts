import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSeeStudent, requireRole, STAFF, studentScope } from "@/lib/permissions";
import { audit } from "@/lib/audit";

const TYPES = ["IN_PERSON", "INDEPENDENT_STUDY"] as const;

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const classId = typeof body.classId === "string" ? body.classId : "";
  const type = TYPES.includes(body.type) ? (body.type as (typeof TYPES)[number]) : "IN_PERSON";
  if (!studentId || !classId) {
    return NextResponse.json({ error: "Pick a student and a class" }, { status: 400 });
  }
  if (!(await canSeeStudent(auth.user, studentId))) {
    return NextResponse.json({ error: "That student isn't in your stake" }, { status: 403 });
  }

  const [student, cls] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { user: { select: { name: true } } } }),
    prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } }),
  ]);
  if (!student || !cls) return NextResponse.json({ error: "Student or class not found" }, { status: 404 });

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
  });
  if (existing) {
    return NextResponse.json({ error: "This student is already enrolled in this class" }, { status: 409 });
  }

  const enrollment = await prisma.enrollment.create({
    data: { studentId, classId, type },
    include: {
      student: { include: { user: { select: { name: true, email: true } } } },
      class: true,
    },
  });
  await audit(auth.user, "ENROLLED", `${auth.user.name} enrolled ${student.user.name} in ${cls.name}`, enrollment.id);
  return NextResponse.json(enrollment, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const enrollments = await prisma.enrollment.findMany({
    where: { student: studentScope(auth.user) },
    include: {
      student: { include: { user: { select: { name: true, email: true } } } },
      class: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(enrollments);
}
