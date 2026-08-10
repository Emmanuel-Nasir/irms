import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: currentUser.userId } });
  if (!teacher) {
    return NextResponse.json([]);
  }

  const classes = await prisma.class.findMany({
    where: { teacherId: teacher.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(classes);
}