import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["AREA_ADMIN"]);
  if (!auth.ok) return auth.response;

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { name, email, passwordHash, role: "STAKE_ADMIN" },
  });

  return NextResponse.json({ id: admin.id, name: admin.name, email: admin.email }, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(["AREA_ADMIN"]);
  if (!auth.ok) return auth.response;

  const admins = await prisma.user.findMany({
    where: { role: "STAKE_ADMIN" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(admins);
}