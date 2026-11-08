import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireRole, ALL_ROLES, type AppRole } from "@/lib/permissions";

export async function GET() {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
  }
  if (!ALL_ROLES.includes(role)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: role as AppRole,
      // Teachers and students also need their profile row
      ...(role === "TEACHER" ? { teacher: { create: {} } } : {}),
      ...(role === "STUDENT" ? { student: { create: {} } } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json(user, { status: 201 });
}