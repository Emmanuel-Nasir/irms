import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF, studentScope } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { COMPLETE_AT_PERCENT, graduationStandings, recalculateCredits } from "@/lib/graduation";

// Everyone's standing (leaders limited to a stake see their own stake)
export async function GET() {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const standings = await graduationStandings(studentScope(auth.user));
  return NextResponse.json({ standings, completeAtPercent: COMPLETE_AT_PERCENT });
}

/**
 * Mark classes as completed (each completed class is one credit, core or elective).
 *   { action: "complete", enrollmentIds: [...] }
 *   { action: "complete-ready" }   every finished class where the student came often enough
 *   { action: "reopen", enrollmentIds: [...] }   undo a completion
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));

  let ids: string[] = [];
  if (body.action === "complete-ready") {
    const standings = await graduationStandings(studentScope(auth.user));
    ids = standings.flatMap((s) => s.classes.filter((c) => c.readyToComplete).map((c) => c.enrollmentId));
  } else if ((body.action === "complete" || body.action === "reopen") && Array.isArray(body.enrollmentIds)) {
    ids = body.enrollmentIds.filter((x: unknown) => typeof x === "string").slice(0, 500);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ updated: 0 });

  // Only students this leader may see
  const allowed = await prisma.enrollment.findMany({
    where: { id: { in: ids }, student: studentScope(auth.user) },
    select: { id: true, studentId: true, student: { select: { user: { select: { name: true } } } }, class: { select: { name: true } } },
  });
  const status = body.action === "reopen" ? "ACTIVE" : "COMPLETED";
  await prisma.enrollment.updateMany({ where: { id: { in: allowed.map((a) => a.id) } }, data: { status } });
  for (const studentId of new Set(allowed.map((a) => a.studentId))) await recalculateCredits(studentId);

  await audit(
    auth.user,
    "CLASSES_COMPLETED",
    allowed.length === 1
      ? `${auth.user.name} marked ${allowed[0].student.user.name}'s ${allowed[0].class.name} as ${status === "COMPLETED" ? "completed" : "not completed"}`
      : `${auth.user.name} marked ${allowed.length} classes as ${status === "COMPLETED" ? "completed" : "not completed"}`
  );
  return NextResponse.json({ updated: allowed.length });
}
