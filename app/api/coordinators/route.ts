import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

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

  const coordinator = await prisma.user.create({
    data: { name, email, passwordHash, role: "COORDINATOR" },
  });

  return NextResponse.json(
    { id: coordinator.id, name: coordinator.name, email: coordinator.email },
    { status: 201 }
  );
}

export async function GET() {
  const coordinators = await prisma.user.findMany({
    where: { role: "COORDINATOR" },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(coordinators);
}