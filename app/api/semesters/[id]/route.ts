import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPassword, requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { parseDayKey, startOfDay } from "@/lib/dates";

const STATUSES = ["UPCOMING", "ACTIVE", "CLOSED"] as const;

// Rename, change dates, or set the status. Making one semester Active closes any other active one.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const sem = await prisma.semester.findUnique({ where: { id } });
  if (!sem) return NextResponse.json({ error: "Semester not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; startDate?: Date; endDate?: Date; status?: (typeof STATUSES)[number] } = {};
  const changes: string[] = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Give the semester a name" }, { status: 400 });
    if (name !== sem.name) {
      data.name = name;
      changes.push(`renamed to ${name}`);
    }
  }
  if (body.startDate !== undefined || body.endDate !== undefined) {
    const start = parseDayKey(String(body.startDate ?? sem.startDate.toISOString()).slice(0, 10));
    const end = parseDayKey(String(body.endDate ?? sem.endDate.toISOString()).slice(0, 10));
    if (!start || !end) return NextResponse.json({ error: "Pick valid dates" }, { status: 400 });
    if (end < start) return NextResponse.json({ error: "The semester can't end before it starts" }, { status: 400 });
    data.startDate = startOfDay(start);
    data.endDate = startOfDay(end);
    changes.push("changed the dates");
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    data.status = body.status;
    changes.push(`set it to ${String(body.status).toLowerCase()}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.status === "ACTIVE") {
      await tx.semester.updateMany({ where: { status: "ACTIVE", NOT: { id } }, data: { status: "CLOSED" } });
    }
    return tx.semester.update({ where: { id }, data });
  });
  if (changes.length) await audit(auth.user, "SEMESTER_CHANGED", `${auth.user.name} ${changes.join(", ")} (${sem.name})`, id);
  return NextResponse.json(updated);
}

// Super admins only, with password, and only when no classes use it
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const denied = await confirmPassword(auth.user.id, body.confirmPassword);
  if (denied) return denied;

  const sem = await prisma.semester.findUnique({ where: { id }, include: { _count: { select: { classes: true } } } });
  if (!sem) return NextResponse.json({ error: "Semester not found" }, { status: 404 });
  if (sem._count.classes > 0) {
    return NextResponse.json(
      { error: `${sem._count.classes} class${sem._count.classes !== 1 ? "es use" : " uses"} this semester. Move or delete them first, or set it to Closed.` },
      { status: 400 }
    );
  }
  await prisma.event.updateMany({ where: { semesterId: id }, data: { semesterId: null } });
  await prisma.semester.delete({ where: { id } });
  await audit(auth.user, "SEMESTER_CHANGED", `${auth.user.name} deleted the semester ${sem.name}`, id);
  return NextResponse.json({ success: true });
}
