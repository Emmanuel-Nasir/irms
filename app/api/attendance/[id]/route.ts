import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const record = await prisma.attendance.findUnique({
    where: { id },
    select: { classId: true, student: { select: { user: { select: { name: true } } } }, class: { select: { name: true } } },
  });
  if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  if (!(await canManageClass(auth.user, record.classId))) {
    return NextResponse.json({ error: "This isn't your class" }, { status: 403 });
  }

  await prisma.attendance.delete({ where: { id } });
  await audit(auth.user, "ATTENDANCE_REMOVED", `${auth.user.name} removed ${record.student.user.name}'s check-in from ${record.class.name}`, id);
  return NextResponse.json({ success: true });
}