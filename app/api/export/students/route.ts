import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const stake = req.nextUrl.searchParams.get("stake");
  const classId = req.nextUrl.searchParams.get("classId");

  const students = await prisma.student.findMany({
    where: {
      ...(stake ? { stake } : {}),
      ...(classId ? { enrollments: { some: { classId } } } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      enrollments: { include: { class: { select: { name: true } } } },
      graduationProgress: true,
    },
    orderBy: { user: { name: "asc" } },
  });

  const rows = students.map((s) => ({
    name: s.user.name,
    email: s.user.email,
    ward: s.ward ?? "",
    stake: s.stake ?? "",
    phone: s.phone ?? "",
    classes: s.enrollments.map((e) => e.class.name).join("; "),
    core: s.graduationProgress
      ? `${s.graduationProgress.coreCreditsCompleted}/${s.graduationProgress.coreCreditsRequired}`
      : "",
    elective: s.graduationProgress
      ? `${s.graduationProgress.electiveCreditsCompleted}/${s.graduationProgress.electiveCreditsRequired}`
      : "",
  }));

  return NextResponse.json({ rows });
}