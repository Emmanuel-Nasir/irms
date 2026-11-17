import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS } from "@/lib/permissions";
import { todayKey, dayRange } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return auth.response;

  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });
  if (!(await canManageClass(auth.user, classId))) {
    return NextResponse.json({ error: "This isn't your class" }, { status: 403 });
  }

  const records = await prisma.attendance.findMany({
    where: { classId, date: dayRange(todayKey()) },
    include: { student: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(records);
}