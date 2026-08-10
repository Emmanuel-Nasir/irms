import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
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
    include: { user: true },
  });

  return NextResponse.json(teacher, { status: 201 });
}

export async function GET() {
  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(teachers);
}