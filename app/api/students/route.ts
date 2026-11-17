import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/passwords";
import { requireRole, STAFF, stakeScope, studentScope } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = v.name(body.name);
  const email = v.email(body.email);
  const ward = v.optionalText(body.ward, "Ward");
  const stakeIn = v.optionalText(body.stake, "Stake");
  const phone = v.phone(body.phone);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 });
  if (!ward.ok) return NextResponse.json({ error: ward.error }, { status: 400 });
  if (!stakeIn.ok) return NextResponse.json({ error: stakeIn.error }, { status: 400 });
  if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });

  const problem = passwordProblem(body.password, { name: name.value, email: email.value });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await prisma.user.findFirst({ where: { email: { equals: email.value, mode: "insensitive" } } })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  // Leaders limited to a stake can only register students in that stake
  const stake = stakeScope(auth.user) ?? stakeIn.value;

  const student = await prisma.student.create({
    data: {
      ward: ward.value,
      stake,
      phone: phone.value,
      user: {
        create: { name: name.value, email: email.value, passwordHash: await bcrypt.hash(body.password, 12), role: "STUDENT", mustChangePassword: true },
      },
    },
    include: { user: { select: { name: true, email: true } } },
  });

  await audit(auth.user, "STUDENT_ADDED", `${auth.user.name} registered student ${name.value}${stake ? ` (${stake})` : ""}`, student.id);
  return NextResponse.json(student, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const students = await prisma.student.findMany({
    where: studentScope(auth.user),
    include: {
      user: { select: { name: true, email: true } },
      graduationProgress: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(students);
}
