import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canSeeStudent, requireRole, STAFF, stakeScope } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { graduationStandings } from "@/lib/graduation";
import * as v from "@/lib/validate";

// Everything about one student, for leaders
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!(await canSeeStudent(auth.user, id))) {
    return NextResponse.json({ error: "That student isn't in your stake" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, lastLoginAt: true, createdAt: true } },
      attendanceRecords: { orderBy: { date: "desc" }, take: 30, include: { class: { select: { name: true } } } },
      eventRsvps: { include: { event: { select: { title: true, date: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  const [standing] = await graduationStandings({ id });

  return NextResponse.json({
    id: student.id,
    name: student.user.name,
    email: student.user.email,
    phone: student.phone,
    ward: student.ward,
    stake: student.stake,
    occupation: student.occupation,
    school: student.school,
    active: student.active,
    joined: student.user.createdAt,
    lastLoginAt: student.user.lastLoginAt,
    standing,
    attendance: student.attendanceRecords.map((a) => ({ id: a.id, date: a.date, status: a.status, className: a.class.name })),
    events: student.eventRsvps.map((r) => ({ title: r.event.title, date: r.event.date, status: r.status })),
    canEditStake: !stakeScope(auth.user),
  });
}

// Leaders correct a student's details
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!(await canSeeStudent(auth.user, id))) {
    return NextResponse.json({ error: "That student isn't in your stake" }, { status: 403 });
  }
  const student = await prisma.student.findUnique({ where: { id }, include: { user: true } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = v.name(body.name ?? student.user.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const phone = v.phone(body.phone ?? student.phone);
  if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });
  const ward = v.optionalText(body.ward ?? student.ward, "Ward");
  if (!ward.ok) return NextResponse.json({ error: ward.error }, { status: 400 });
  // Leaders limited to a stake can't move students to another stake
  const stake = stakeScope(auth.user) ? { ok: true as const, value: student.stake } : v.optionalText(body.stake ?? student.stake, "Stake");
  if (!stake.ok) return NextResponse.json({ error: stake.error }, { status: 400 });

  await prisma.$transaction([
    prisma.user.update({ where: { id: student.userId }, data: { name: name.value } }),
    prisma.student.update({
      where: { id },
      data: {
        phone: phone.value,
        ward: ward.value,
        stake: stake.value,
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      },
    }),
  ]);
  await audit(auth.user, "STUDENT_UPDATED", `${auth.user.name} updated ${name.value}'s details`, id);
  return NextResponse.json({ success: true });
}
