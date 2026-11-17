import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSeeStudent, requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { studentId } = await params;
  if (!(await canSeeStudent(auth.user, studentId))) {
    return NextResponse.json({ error: "That student isn't in your stake" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const fields = {
    coreCreditsCompleted: v.wholeNumber(body.coreCreditsCompleted, "Core credits completed", 0, 50),
    coreCreditsRequired: v.wholeNumber(body.coreCreditsRequired, "Core credits required", 0, 50),
    electiveCreditsCompleted: v.wholeNumber(body.electiveCreditsCompleted, "Elective credits completed", 0, 50),
    electiveCreditsRequired: v.wholeNumber(body.electiveCreditsRequired, "Elective credits required", 0, 50),
  };
  const data: Record<string, number> = {};
  for (const [key, r] of Object.entries(fields)) {
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    data[key] = r.value;
  }

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: { select: { name: true } } } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const progress = await prisma.graduationProgress.upsert({
    where: { studentId },
    update: data,
    create: { studentId, ...data },
  });
  await audit(
    auth.user,
    "GRADUATION_UPDATED",
    `${auth.user.name} set ${student.user.name}'s credits to core ${data.coreCreditsCompleted}/${data.coreCreditsRequired}, elective ${data.electiveCreditsCompleted}/${data.electiveCreditsRequired}`,
    studentId
  );
  return NextResponse.json(progress);
}
