import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSeeStudent, requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { recalculateCredits } from "@/lib/graduation";
import * as v from "@/lib/validate";

/**
 * One student's graduation record.
 *   { action: "graduate", date?: "YYYY-MM-DD" }  mark as graduated
 *   { action: "ungraduate" }                     undo
 *   { action: "recalculate" }                    set credits from completed classes
 *   { coreCreditsRequired, electiveCreditsRequired, coreCreditsCompleted, electiveCreditsCompleted }  set numbers by hand
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { studentId } = await params;
  if (!(await canSeeStudent(auth.user, studentId))) {
    return NextResponse.json({ error: "That student isn't in your stake" }, { status: 403 });
  }
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: { select: { name: true } } } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const who = student.user.name;

  if (body.action === "graduate" || body.action === "ungraduate") {
    const graduating = body.action === "graduate";
    const date = graduating ? (typeof body.date === "string" && body.date ? new Date(`${body.date}T12:00:00Z`) : new Date()) : null;
    if (date && Number.isNaN(date.getTime())) return NextResponse.json({ error: "Pick a valid date" }, { status: 400 });
    const progress = await prisma.graduationProgress.upsert({
      where: { studentId },
      update: { graduated: graduating, graduationDate: date },
      create: { studentId, graduated: graduating, graduationDate: date },
    });
    await audit(auth.user, "GRADUATION_UPDATED", `${auth.user.name} ${graduating ? "marked" : "unmarked"} ${who} as graduated`, studentId);
    return NextResponse.json(progress);
  }

  if (body.action === "recalculate") {
    const progress = await recalculateCredits(studentId);
    await audit(auth.user, "GRADUATION_UPDATED", `${auth.user.name} recalculated ${who}'s credits from completed classes`, studentId);
    return NextResponse.json(progress);
  }

  // Numbers set by hand (any of them)
  const data: Record<string, number> = {};
  for (const [key, label] of [
    ["coreCreditsCompleted", "Core credits completed"],
    ["coreCreditsRequired", "Core credits required"],
    ["electiveCreditsCompleted", "Elective credits completed"],
    ["electiveCreditsRequired", "Elective credits required"],
  ] as const) {
    if (body[key] === undefined) continue;
    const r = v.wholeNumber(body[key], label, 0, 50);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    data[key] = r.value;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const progress = await prisma.graduationProgress.upsert({
    where: { studentId },
    update: data,
    create: { studentId, ...data },
  });
  await audit(
    auth.user,
    "GRADUATION_UPDATED",
    `${auth.user.name} set ${who}'s credits: ${Object.entries(data).map(([k, n]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()} ${n}`).join(", ")}`,
    studentId
  );
  return NextResponse.json(progress);
}
