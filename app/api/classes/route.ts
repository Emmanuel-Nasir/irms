import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { name, category, semesterId, dayOfWeek, startTime, venue, capacity } = await req.json();

  if (!name || !semesterId) {
    return NextResponse.json(
      { error: "Name and semesterId are required" },
      { status: 400 }
    );
  }

  const newClass = await prisma.class.create({
    data: {
      name,
      category: category || "SCRIPTURE_STUDY",
      semesterId,
      dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== "" ? Number(dayOfWeek) : null,
      startTime: startTime || null,
      venue: venue || null,
      capacity: capacity ? Number(capacity) : null,
    },
  });

  return NextResponse.json(newClass, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const classes = await prisma.class.findMany({
    include: {
      semester: true,
      teacher: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(classes);
}