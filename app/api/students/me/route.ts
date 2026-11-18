import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { courseProgress } from "@/lib/coursePeriod";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { userId: currentUser.userId },
    include: {
      user: { select: { name: true, email: true } },
      graduationProgress: true,
      enrollments: {
        where: { status: { not: "DROPPED" } },
        include: {
          class: {
            include: { semester: true, teacher: { include: { user: { select: { name: true } } } } },
          },
        },
      },
      attendanceRecords: { orderBy: { date: "desc" }, take: 10, include: { class: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "This account isn't a student" }, { status: 403 });
  }

  // For each class: "Class 4 of 12", and this student's attendance % over the course so far
  const progress = await courseProgress(
    student.enrollments.map((e) => e.class),
    student.id
  );

  return NextResponse.json({
    ...student,
    enrollments: student.enrollments.map((e) => ({ ...e, progress: progress[e.class.id] })),
  });
}
