import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { name, email, password, phone } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const teacher = await prisma.teacher.create({
    data: {
      phone: phone || null,
      user: {
        create: { name, email, passwordHash, role: "TEACHER" },
      },
    },
    include: { user: { select: { name: true, email: true } } },
  });

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