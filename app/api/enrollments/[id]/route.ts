import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSeeStudent, requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { recalculateCredits } from "@/lib/graduation";

async function load(id: string) {
  return prisma.enrollment.findUnique({
    where: { id },
    include: { student: { include: { user: { select: { name: true } } } }, class: { select: { name: true } } },
  });
}

// Change an enrollment: status ACTIVE / DROPPED / COMPLETED, or type IN_PERSON / INDEPENDENT_STUDY
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const en = await load(id);
  if (!en) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  if (!(await canSeeStudent(auth.user, en.studentId))) {
    return NextResponse.json({ error: "That student isn't in your stake" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const data: { status?: "ACTIVE" | "DROPPED" | "COMPLETED"; type?: "IN_PERSON" | "INDEPENDENT_STUDY" } = {};
  if (["ACTIVE", "DROPPED", "COMPLETED"].includes(body.status)) data.status = body.status;
  if (["IN_PERSON", "INDEPENDENT_STUDY"].includes(body.type)) data.type = body.type;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const updated = await prisma.enrollment.update({ where: { id }, data });
  if (data.status) await recalculateCredits(en.studentId);
  await audit(
    auth.user,
    "ENROLLMENT_CHANGED",
    `${auth.user.name} set ${en.student.user.name} in ${en.class.name} to ${[data.status, data.type].filter(Boolean).join(", ").toLowerCase().replace("_", " ")}`,
    id
  );
  return NextResponse.json(updated);
}

// Remove an enrollment entirely (their attendance records stay, for the history)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const en = await load(id);
  if (!en) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  if (!(await canSeeStudent(auth.user, en.studentId))) {
    return NextResponse.json({ error: "That student isn't in your stake" }, { status: 403 });
  }
  await prisma.enrollment.delete({ where: { id } });
  await recalculateCredits(en.studentId);
  await audit(auth.user, "ENROLLMENT_CHANGED", `${auth.user.name} removed ${en.student.user.name} from ${en.class.name}`, id);
  return NextResponse.json({ success: true });
}
