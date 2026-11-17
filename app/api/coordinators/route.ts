import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/passwords";
import { requireRole, stakeScope } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["AREA_ADMIN", "STAKE_ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = v.name(body.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const email = v.email(body.email);
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 });
  const stakeIn = v.optionalText(body.stake, "Stake");
  if (!stakeIn.ok) return NextResponse.json({ error: stakeIn.error }, { status: 400 });
  const problem = passwordProblem(body.password, { name: name.value, email: email.value });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await prisma.user.findFirst({ where: { email: { equals: email.value, mode: "insensitive" } } })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  // A stake admin's coordinators belong to the same stake
  const stake = stakeScope(auth.user) ?? stakeIn.value;

  const coordinator = await prisma.user.create({
    data: {
      name: name.value,
      email: email.value,
      passwordHash: await bcrypt.hash(body.password, 12),
      role: "COORDINATOR",
      stake,
      mustChangePassword: true,
    },
  });
  await audit(auth.user, "USER_ADDED", `${auth.user.name} added coordinator ${coordinator.name}${stake ? ` for ${stake}` : ""}`, coordinator.id);
  return NextResponse.json(
    { id: coordinator.id, name: coordinator.name, email: coordinator.email, stake: coordinator.stake },
    { status: 201 }
  );
}

export async function GET() {
  const auth = await requireRole(["AREA_ADMIN", "STAKE_ADMIN"]);
  if (!auth.ok) return auth.response;

  const stake = stakeScope(auth.user);
  const coordinators = await prisma.user.findMany({
    where: { role: "COORDINATOR", ...(stake ? { stake: { equals: stake, mode: "insensitive" } } : {}) },
    select: { id: true, name: true, email: true, stake: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(coordinators);
}
