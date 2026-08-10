import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { userId: currentUser.userId },
    include: {
      user: true,
      graduationProgress: true,
      enrollments: { include: { class: { include: { semester: true } } } },
      attendanceRecords: { orderBy: { date: "desc" }, take: 10, include: { class: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "This account isn't a student" }, { status: 403 });
  }

  return NextResponse.json(student);
}