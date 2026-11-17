import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole } from "@/lib/permissions";
import { classAccess } from "@/lib/classAccess";
import { startOfDay } from "@/lib/dates";
import { audit } from "@/lib/audit";
import { readPlan } from "@/lib/plans";

async function load(id: string) {
  return prisma.lessonPlan.findUnique({ where: { id } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const plan = await load(id);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (!(await classAccess(auth.user, plan.classId)).canEdit) {
    return NextResponse.json({ error: "You can't change this plan" }, { status: 403 });
  }

  const parsed = readPlan(await req.json().catch(() => ({})), false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { date, ...rest } = parsed.data;

  const updated = await prisma.lessonPlan.update({
    where: { id },
    data: { ...rest, ...(date !== undefined ? { date: date ? startOfDay(date) : null } : {}) },
  });
  if (rest.status && rest.status !== plan.status) {
    await audit(auth.user, "LESSON_PLANNED", `${auth.user.name} marked "${updated.title}" as ${rest.status.toLowerCase()}`, id);
  }
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const plan = await load(id);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (!(await classAccess(auth.user, plan.classId)).canEdit) {
    return NextResponse.json({ error: "You can't delete this plan" }, { status: 403 });
  }
  await prisma.lessonPlan.delete({ where: { id } });
  await audit(auth.user, "LESSON_DELETED", `${auth.user.name} deleted the lesson plan "${plan.title}"`, id);
  return NextResponse.json({ success: true });
}
