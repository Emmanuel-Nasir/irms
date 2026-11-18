import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

const CHOICES = ["GOING", "MAYBE", "NOT_GOING"] as const;

// A student says whether they're coming. Sending the same answer again clears it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["STUDENT"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { userId: auth.user.id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "Only students can reply to events" }, { status: 403 });

  const event = await prisma.event.findUnique({ where: { id }, select: { date: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.date.getTime() < Date.now() - 6 * 3600000) {
    return NextResponse.json({ error: "This event has already happened" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const status = CHOICES.find((c) => c === body.status);
  if (!status) return NextResponse.json({ error: "Choose Going, Maybe or Can't come" }, { status: 400 });

  const existing = await prisma.eventRsvp.findUnique({ where: { studentId_eventId: { studentId: student.id, eventId: id } } });
  if (existing?.status === status) {
    await prisma.eventRsvp.delete({ where: { id: existing.id } });
    return NextResponse.json({ status: null });
  }
  await prisma.eventRsvp.upsert({
    where: { studentId_eventId: { studentId: student.id, eventId: id } },
    create: { studentId: student.id, eventId: id, status },
    update: { status },
  });
  return NextResponse.json({ status });
}
