import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }
  const records = await prisma.attendance.findMany({
    where: { classId, date: startOfToday() },
    include: { student: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(records);
}