import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole } from "@/lib/permissions";
import { classAccess } from "@/lib/classAccess";
import { startOfDay } from "@/lib/dates";
import { audit } from "@/lib/audit";
import { readPlan } from "@/lib/plans";

// Lesson plans for a class. Students only get plans the teacher has shared and marked ready or taught.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const access = await classAccess(auth.user, id);
  if (!access.canView) return NextResponse.json({ error: "You can't open this class" }, { status: 403 });

  const plans = await prisma.lessonPlan.findMany({
    where: { classId: id, ...(access.canEdit ? {} : { shared: true, status: { in: ["READY", "TAUGHT"] } }) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    // Private teaching notes stay with the teacher
    select: access.canEdit
      ? undefined
      : { id: true, title: true, date: true, scriptures: true, objectives: true, status: true, shared: true },
  });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const access = await classAccess(auth.user, id);
  if (!access.canEdit) return NextResponse.json({ error: "Only this class's teacher or a leader can plan lessons" }, { status: 403 });

  const parsed = readPlan(await req.json().catch(() => ({})), true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const day = parsed.data.date === undefined ? null : parsed.data.date;
  const plan = await prisma.lessonPlan.create({
    data: {
      ...parsed.data,
      title: parsed.data.title ?? "Lesson",
      date: day ? startOfDay(day) : null,
      classId: id,
      createdById: auth.user.id,
    },
  });
  await audit(auth.user, "LESSON_PLANNED", `${auth.user.name} planned "${plan.title}"`, plan.id);
  return NextResponse.json(plan, { status: 201 });
}

