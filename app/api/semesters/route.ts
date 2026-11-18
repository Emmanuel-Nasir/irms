import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { parseDayKey, startOfDay } from "@/lib/dates";

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const start = parseDayKey(String(body.startDate ?? "").slice(0, 10));
  const end = parseDayKey(String(body.endDate ?? "").slice(0, 10));
  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Give the semester a name" }, { status: 400 });
  if (!start || !end) return NextResponse.json({ error: "Pick the start and end dates" }, { status: 400 });
  if (end < start) return NextResponse.json({ error: "The semester can't end before it starts" }, { status: 400 });

  const semester = await prisma.semester.create({
    data: { name, startDate: startOfDay(start), endDate: startOfDay(end) },
  });
  await audit(auth.user, "SEMESTER_CHANGED", `${auth.user.name} created the semester ${name}`, semester.id);
  return NextResponse.json(semester, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const semesters = await prisma.semester.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { classes: true } } },
  });
  return NextResponse.json(semesters);
}
