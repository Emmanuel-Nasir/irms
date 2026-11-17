import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/passwords";
import { requireRole } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["AREA_ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = v.name(body.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const email = v.email(body.email);
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 });
  const stake = v.optionalText(body.stake, "Stake");
  if (!stake.ok) return NextResponse.json({ error: stake.error }, { status: 400 });
  const problem = passwordProblem(body.password, { name: name.value, email: email.value });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await prisma.user.findFirst({ where: { email: { equals: email.value, mode: "insensitive" } } })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const admin = await prisma.user.create({
    data: {
      name: name.value,
      email: email.value,
      passwordHash: await bcrypt.hash(body.password, 12),
      role: "STAKE_ADMIN",
      stake: stake.value,
      mustChangePassword: true,
    },
  });
  await audit(auth.user, "USER_ADDED", `${auth.user.name} added stake admin ${admin.name}${admin.stake ? ` for ${admin.stake}` : ""}`, admin.id);
  return NextResponse.json({ id: admin.id, name: admin.name, email: admin.email, stake: admin.stake }, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(["AREA_ADMIN"]);
  if (!auth.ok) return auth.response;

  const admins = await prisma.user.findMany({
    where: { role: "STAKE_ADMIN" },
    select: { id: true, name: true, email: true, stake: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(admins);
}
