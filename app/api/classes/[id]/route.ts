import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPassword, requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { readPeriod } from "@/lib/classPeriodInput";

// Leaders change a class: its teacher, and when it runs (start date and how many days)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const cls = await prisma.class.findUnique({ where: { id }, select: { name: true } });
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const data: {
    teacherId?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    dayOfWeek?: number | null;
    creditType?: "CORE" | "ELECTIVE";
    name?: string;
    category?: "CORNERSTONE" | "GOSPEL" | "SCRIPTURE" | "OTHER" | "SCRIPTURE_STUDY" | "MISSIONARY_PREP" | "INSTITUTE_FOUNDATIONS";
    startTime?: string | null;
    venue?: string | null;
    archived?: boolean;
  } = {};
  const changes: string[] = [];

  if (body.teacherId !== undefined) {
    data.teacherId = body.teacherId || null;
    changes.push(body.teacherId ? "assigned a teacher" : "removed the teacher");
  }
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (n.length < 2 || n.length > 120) return NextResponse.json({ error: "Give the class a name" }, { status: 400 });
    data.name = n;
    changes.push(`renamed it to ${n}`);
  }
  if (["CORNERSTONE", "GOSPEL", "SCRIPTURE", "OTHER", "SCRIPTURE_STUDY", "MISSIONARY_PREP", "INSTITUTE_FOUNDATIONS"].includes(body.category)) {
    data.category = body.category;
  }
  if (body.startTime !== undefined) data.startTime = String(body.startTime ?? "").trim().slice(0, 20) || null;
  if (body.venue !== undefined) data.venue = String(body.venue ?? "").trim().slice(0, 120) || null;
  if (typeof body.archived === "boolean") {
    data.archived = body.archived;
    changes.push(body.archived ? "archived it" : "brought it back from the archive");
  }
  if (body.creditType === "CORE" || body.creditType === "ELECTIVE") {
    data.creditType = body.creditType;
    changes.push(`made it a ${body.creditType.toLowerCase()} credit`);
  }
  if (body.dayOfWeek !== undefined) {
    const d = body.dayOfWeek === "" || body.dayOfWeek === null ? null : Number(body.dayOfWeek);
    if (d !== null && !(Number.isInteger(d) && d >= 0 && d <= 6)) {
      return NextResponse.json({ error: "Pick a day of the week" }, { status: 400 });
    }
    data.dayOfWeek = d;
    changes.push("changed the day");
  }
  const period = readPeriod(body);
  if ("error" in period) return NextResponse.json({ error: period.error }, { status: 400 });
  if (period.startDate !== undefined) {
    data.startDate = period.startDate;
    data.endDate = period.endDate ?? null;
    changes.push(period.startDate ? "set when the course runs" : "cleared the course dates (uses the semester)");
  }

  const updated = await prisma.class.update({ where: { id }, data });
  if (changes.length) await audit(auth.user, "CLASS_CHANGED", `${auth.user.name} ${changes.join(", ")} for ${cls.name}`, id);
  return NextResponse.json(updated);
}

// Deleting a class removes everything attached to it, for good. Super admins only, with password.
// (Archiving is the gentler option: the class disappears from lists but its records stay.)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const denied = await confirmPassword(auth.user.id, body.confirmPassword);
  if (denied) return denied;

  const cls = await prisma.class.findUnique({ where: { id }, select: { name: true } });
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { classId: id } });
    await tx.attendanceSession.deleteMany({ where: { classId: id } });
    await tx.enrollment.deleteMany({ where: { classId: id } });
    await tx.resource.deleteMany({ where: { classId: id } });
    await tx.lessonPlan.deleteMany({ where: { classId: id } });
    await tx.announcement.deleteMany({ where: { classId: id } });
    await tx.class.delete({ where: { id } });
  });
  await audit(auth.user, "CLASS_DELETED", `${auth.user.name} deleted the class ${cls.name} and its records`, id);
  return NextResponse.json({ success: true });
}
