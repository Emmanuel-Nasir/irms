import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { distanceInMeters, allowedDistance } from "@/lib/geo";
import { dayKey, dayRange } from "@/lib/dates";

function fail(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;
  const accuracy = typeof body.accuracy === "number" ? body.accuracy : undefined;

  const auth = await requireRole(["STUDENT"]);
  if (!auth.ok) return auth.response;

  const student = await prisma.student.findUnique({ where: { userId: auth.user.id } });
  if (!student) return fail("Only students can check in", "NOT_STUDENT", 403);

  const session = await prisma.attendanceSession.findUnique({
    where: { token },
    include: { class: { select: { name: true } } },
  });
  if (!session) {
    return fail("This QR code isn't valid. Scan the code that's on screen now.", "INVALID", 404);
  }
  if (session.expiresAt < new Date()) {
    return fail("This QR code has expired. Scan the code that's on screen now.", "EXPIRED", 410);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId: student.id, classId: session.classId } },
  });
  if (!enrollment) {
    return fail("You are not enrolled in this class. Ask your coordinator to enroll you.", "NOT_ENROLLED", 403);
  }

  if (session.latitude != null && session.longitude != null) {
    if (latitude === null || longitude === null) {
      return fail("Your location is needed to check in.", "LOCATION_REQUIRED", 400);
    }
    const distance = distanceInMeters(session.latitude, session.longitude, latitude, longitude);
    const allowed = allowedDistance(accuracy);
    if (distance > allowed) {
      return fail(
        `You appear to be about ${Math.round(distance)} m from the class location (the limit is ${Math.round(allowed)} m).`,
        "TOO_FAR",
        403
      );
    }
  }

  // One record per student, per class, per day. Look it up by the whole day so a
  // second scan (or a record saved by older code) updates it instead of adding another.
  const existing = await prisma.attendance.findFirst({
    where: { studentId: student.id, classId: session.classId, date: dayRange(dayKey(session.date)) },
  });
  const alreadyCheckedIn = existing?.status === "PRESENT";

  const attendance = existing
    ? await prisma.attendance.update({ where: { id: existing.id }, data: { status: "PRESENT" } })
    : await prisma.attendance.upsert({
        where: {
          studentId_classId_date: { studentId: student.id, classId: session.classId, date: session.date },
        },
        update: { status: "PRESENT" },
        create: { studentId: student.id, classId: session.classId, date: session.date, status: "PRESENT" },
      });

  return NextResponse.json(
    { ...attendance, className: session.class.name, alreadyCheckedIn },
    { status: alreadyCheckedIn ? 200 : 201 }
  );
}