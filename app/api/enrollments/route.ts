import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { studentId, classId, type } = await req.json();

  if (!studentId || !classId) {
    return NextResponse.json(
      { error: "studentId and classId are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This student is already enrolled in this class" },
      { status: 409 }
    );
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      classId,
      type: type || "IN_PERSON",
    },
    include: { student: { include: { user: true } }, class: true },
  });

  return NextResponse.json(enrollment, { status: 201 });
}

export async function GET() {
  const enrollments = await prisma.enrollment.findMany({
    include: { student: { include: { user: true } }, class: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(enrollments);
}