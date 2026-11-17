import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/passwords";
import { requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = v.name(body.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const email = v.email(body.email);
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 });
  const phone = v.phone(body.phone);
  if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });
  const problem = passwordProblem(body.password, { name: name.value, email: email.value });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await prisma.user.findFirst({ where: { email: { equals: email.value, mode: "insensitive" } } })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const teacher = await prisma.teacher.create({
    data: {
      phone: phone.value,
      user: {
        create: { name: name.value, email: email.value, passwordHash: await bcrypt.hash(body.password, 12), role: "TEACHER", mustChangePassword: true },
      },
    },
    include: { user: { select: { name: true, email: true } } },
  });
  await audit(auth.user, "USER_ADDED", `${auth.user.name} added teacher ${name.value}`, teacher.id);
  return NextResponse.json(teacher, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(teachers);
}
