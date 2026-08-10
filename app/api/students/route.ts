import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name, email, password, ward, stake, phone } = await req.json();

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

  const student = await prisma.student.create({
    data: {
      ward: ward || null,
      stake: stake || null,
      phone: phone || null,
      user: {
        create: { name, email, passwordHash, role: "STUDENT" },
      },
    },
    include: { user: true },
  });

  return NextResponse.json(student, { status: 201 });
}

export async function GET() {
  const students = await prisma.student.findMany({
    include: { user: true, graduationProgress: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(students);
}