import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { distanceInMeters, MAX_CHECKIN_DISTANCE_METERS } from "@/lib/geo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { latitude, longitude } = await req.json().catch(() => ({}));

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "You must be logged in to check in" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({ where: { userId: currentUser.userId } });
  if (!student) {
    return NextResponse.json({ error: "Only students can check in" }, { status: 403 });
  }

  const session = await prisma.attendanceSession.findUnique({ where: { token } });
  if (!session) {
    return NextResponse.json({ error: "This QR code is invalid" }, { status: 404 });
  }
  if (session.expiresAt < new Date()) {
    return NextResponse.json({ error: "This QR code has expired — ask the teacher for the current one" }, { status: 410 });
  }

  if (session.latitude != null && session.longitude != null) {
    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "Location access is required to check in" },
        { status: 400 }
      );
    }
    const distance = distanceInMeters(session.latitude, session.longitude, latitude, longitude);
    if (distance > MAX_CHECKIN_DISTANCE_METERS) {
      return NextResponse.json(
        { error: "You don't appear to be at the class location" },
        { status: 403 }
      );
    }
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId: student.id, classId: session.classId } },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "You are not enrolled in this class" }, { status: 403 });
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      studentId_classId_date: { studentId: student.id, classId: session.classId, date: session.date },
    },
    update: { status: "PRESENT" },
    create: { studentId: student.id, classId: session.classId, date: session.date, status: "PRESENT" },
  });

  return NextResponse.json(attendance, { status: 201 });
}