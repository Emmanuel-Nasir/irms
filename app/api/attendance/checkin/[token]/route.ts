import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { distanceInMeters, allowedDistance } from "@/lib/geo";
import { dayKey, dayRange } from "@/lib/dates";

// A random ID kept in a cookie on each phone, so the teacher can see when one phone
// checks in two different students. It identifies the browser, not the person.
const DEVICE_COOKIE = "irms_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

function fail(error: string, code: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, code, ...extra }, { status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;
  const accuracy = typeof body.accuracy === "number" ? body.accuracy : null;

  const auth = await requireRole(["STUDENT"]);
  if (!auth.ok) return auth.response;

  const student = await prisma.student.findUnique({ where: { userId: auth.user.id } });
  if (!student) return fail("Only students can check in.", "NOT_STUDENT", 403);

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
  if (!enrollment || enrollment.status === "DROPPED") {
    return fail("You are not enrolled in this class. Ask your coordinator to enroll you.", "NOT_ENROLLED", 403);
  }

  if (session.latitude != null && session.longitude != null) {
    if (latitude === null || longitude === null) {
      return fail("Your location is needed to check in.", "LOCATION_REQUIRED", 400);
    }
    const distance = distanceInMeters(session.latitude, session.longitude, latitude, longitude);
    const allowed = allowedDistance(accuracy, session.accuracy);
    if (distance > allowed) {
      return fail(
        `Your phone puts you about ${Math.round(distance)} m from the classroom. Check-in works within ${Math.round(allowed)} m.`,
        "TOO_FAR",
        403,
        {
          distance: Math.round(distance),
          allowed: Math.round(allowed),
          studentAccuracy: accuracy === null ? null : Math.round(accuracy),
        }
      );
    }
  }

  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value || crypto.randomUUID();

  // One record per student, per class, per day. Look it up by the whole day so a
  // second scan (or a record saved by older code) updates it instead of adding another.
  const existing = await prisma.attendance.findFirst({
    where: { studentId: student.id, classId: session.classId, date: dayRange(dayKey(session.date)) },
  });
  // Scanning doesn't undo "Late" from the teacher; it does turn "Absent" or "Excused" into "Present"
  const alreadyCheckedIn = existing?.status === "PRESENT" || existing?.status === "LATE";

  const attendance = existing
    ? await prisma.attendance.update({
        where: { id: existing.id },
        data: alreadyCheckedIn ? { deviceId: existing.deviceId ?? deviceId } : { status: "PRESENT", deviceId },
      })
    : await prisma.attendance.upsert({
        where: {
          studentId_classId_date: { studentId: student.id, classId: session.classId, date: session.date },
        },
        update: { status: "PRESENT", deviceId },
        create: {
          studentId: student.id,
          classId: session.classId,
          date: session.date,
          status: "PRESENT",
          deviceId,
        },
      });

  const res = NextResponse.json(
    { id: attendance.id, status: attendance.status, className: session.class.name, alreadyCheckedIn },
    { status: alreadyCheckedIn ? 200 : 201 }
  );
  res.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return res;
}
