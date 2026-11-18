import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole, STAFF, stakeScope } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { readEvent } from "@/lib/eventInput";

// Everyone sees events. Leaders also see who is coming; students see their own reply.
export async function GET(req: NextRequest) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const isLeader = user.role === "SUPER_ADMIN" || STAFF.includes(user.role);
  const limitedTo = stakeScope(user);

  const student = user.role === "STUDENT" ? await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  const past = req.nextUrl.searchParams.get("past") === "1";
  const now = new Date();
  // An event stays "upcoming" until 6 hours after it starts
  const cutoff = new Date(now.getTime() - 6 * 3600000);

  const events = await prisma.event.findMany({
    where: past ? { date: { lt: cutoff } } : { date: { gte: cutoff } },
    orderBy: { date: past ? "desc" : "asc" },
    take: past ? 30 : 100,
    include: {
      semester: { select: { name: true } },
      createdBy: { select: { id: true, name: true } },
      rsvps: {
        select: {
          status: true,
          studentId: true,
          student: { select: { id: true, stake: true, ward: true, user: { select: { name: true } } } },
        },
      },
    },
  });

  return NextResponse.json({
    canCreate: isLeader,
    canRsvp: !!student,
    events: events.map((e) => {
      const visible = limitedTo
        ? e.rsvps.filter((r) => (r.student.stake ?? "").toLowerCase() === limitedTo.toLowerCase())
        : e.rsvps;
      const count = (s: string) => e.rsvps.filter((r) => r.status === s).length;
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        venue: e.venue,
        date: e.date.toISOString(),
        semester: e.semester?.name ?? null,
        semesterId: e.semesterId,
        createdBy: e.createdBy.name,
        counts: { going: count("GOING"), maybe: count("MAYBE"), notGoing: count("NOT_GOING") },
        myRsvp: student ? e.rsvps.find((r) => r.studentId === student.id)?.status ?? null : null,
        canEdit: user.role === "SUPER_ADMIN" || (isLeader && (!limitedTo || e.createdBy.id === user.id)),
        attendees: isLeader
          ? visible.map((r) => ({ id: r.student.id, name: r.student.user.name, ward: r.student.ward, stake: r.student.stake, status: r.status }))
          : undefined,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const input = readEvent(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  if (input.value.date.getTime() < Date.now() - 86400000) {
    return NextResponse.json({ error: "That date has already passed" }, { status: 400 });
  }
  if (input.value.semesterId && !(await prisma.semester.findUnique({ where: { id: input.value.semesterId } }))) {
    return NextResponse.json({ error: "Semester not found" }, { status: 400 });
  }
  const event = await prisma.event.create({ data: { ...input.value, createdById: auth.user.id } });
  await audit(auth.user, "EVENT_CREATED", `Planned "${event.title}"`, event.id);
  return NextResponse.json({ success: true, id: event.id }, { status: 201 });
}
