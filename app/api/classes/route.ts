import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { readPeriod } from "@/lib/classPeriodInput";
import { courseProgress } from "@/lib/coursePeriod";

const CATEGORIES = ["CORNERSTONE", "GOSPEL", "SCRIPTURE", "OTHER", "SCRIPTURE_STUDY", "MISSIONARY_PREP", "INSTITUTE_FOUNDATIONS"];

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Give the class a name" }, { status: 400 });
  if (!body.semesterId) return NextResponse.json({ error: "Pick a semester" }, { status: 400 });
  const semester = await prisma.semester.findUnique({ where: { id: String(body.semesterId) } });
  if (!semester) return NextResponse.json({ error: "Semester not found" }, { status: 404 });

  const dayOfWeek = body.dayOfWeek !== undefined && body.dayOfWeek !== "" ? Number(body.dayOfWeek) : null;
  if (dayOfWeek !== null && !(Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6)) {
    return NextResponse.json({ error: "Pick a day of the week" }, { status: 400 });
  }
  const period = readPeriod(body);
  if ("error" in period) return NextResponse.json({ error: period.error }, { status: 400 });

  const newClass = await prisma.class.create({
    data: {
      name,
      category: CATEGORIES.includes(body.category) ? body.category : "OTHER",
      creditType: body.creditType === "ELECTIVE" ? "ELECTIVE" : "CORE",
      semesterId: semester.id,
      dayOfWeek,
      startTime: typeof body.startTime === "string" && body.startTime.trim() ? body.startTime.trim().slice(0, 20) : null,
      venue: typeof body.venue === "string" && body.venue.trim() ? body.venue.trim().slice(0, 120) : null,
      capacity: body.capacity ? Number(body.capacity) : null,
      startDate: period.startDate ?? null,
      endDate: period.endDate ?? null,
    },
  });
  await audit(auth.user, "CLASS_CREATED", `${auth.user.name} created the class ${name}`, newClass.id);
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
  const progress = await courseProgress(classes);
  return NextResponse.json(classes.map((c) => ({ ...c, progress: progress[c.id] })));
}
