import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { studentId } = await params;
  const {
    coreCreditsCompleted,
    coreCreditsRequired,
    electiveCreditsCompleted,
    electiveCreditsRequired,
  } = await req.json();

  const progress = await prisma.graduationProgress.upsert({
    where: { studentId },
    update: { coreCreditsCompleted, coreCreditsRequired, electiveCreditsCompleted, electiveCreditsRequired },
    create: { studentId, coreCreditsCompleted, coreCreditsRequired, electiveCreditsCompleted, electiveCreditsRequired },
  });

  return NextResponse.json(progress);
}