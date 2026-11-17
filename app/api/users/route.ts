import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/passwords";
import { requireRole, ALL_ROLES, type AppRole } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

export async function GET() {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      stake: true,
      createdAt: true,
      lastLoginAt: true,
      lockedUntil: true,
      totpEnabledAt: true,
      student: { select: { stake: true } },
    },
    orderBy: { name: "asc" },
  });
  const now = Date.now();
  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      stake: u.stake ?? u.student?.stake ?? null,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      locked: !!u.lockedUntil && u.lockedUntil.getTime() > now,
      twoFactor: !!u.totpEnabledAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = v.name(body.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const email = v.email(body.email);
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 });
  const stake = v.optionalText(body.stake, "Stake");
  if (!stake.ok) return NextResponse.json({ error: stake.error }, { status: 400 });
  const role = body.role as AppRole;
  if (!ALL_ROLES.includes(role)) return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  const problem = passwordProblem(body.password, { name: name.value, email: email.value });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await prisma.user.findFirst({ where: { email: { equals: email.value, mode: "insensitive" } } })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: name.value,
      email: email.value,
      passwordHash: await bcrypt.hash(body.password, 12),
      role,
      mustChangePassword: true,
      stake: role === "STAKE_ADMIN" || role === "COORDINATOR" ? stake.value : null,
      // Teachers and students also need their profile row
      ...(role === "TEACHER" ? { teacher: { create: {} } } : {}),
      ...(role === "STUDENT" ? { student: { create: { stake: stake.value } } } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
  });
  await audit(auth.user, "USER_ADDED", `${auth.user.name} added ${user.name} as ${role.replace("_", " ").toLowerCase()}`, user.id);
  return NextResponse.json(user, { status: 201 });
}
