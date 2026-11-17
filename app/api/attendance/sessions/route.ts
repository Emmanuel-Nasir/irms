import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS } from "@/lib/permissions";
import { startOfToday, todayKey, dayRange } from "@/lib/dates";

// The teacher's screen shows a new code every 60 seconds, but each code keeps
// working for 3 minutes. Finding a phone's location can take up to 30 seconds and
// a student may have to log in first, so a code must outlive the moment it is shown.
// A photo of the code that's passed around still stops working within minutes.
const CODE_LIFETIME_MS = 3 * 60 * 1000;

export async function POST(req: NextRequest) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const classId = typeof body.classId === "string" ? body.classId : "";
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });
  if (!(await canManageClass(auth.user, classId))) {
    return NextResponse.json({ error: "This isn't your class" }, { status: 403 });
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { venueLatitude: true, venueLongitude: true },
  });
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  // Where students are measured from: the saved classroom location if there is one
  // (it was saved deliberately, from a phone in the room), otherwise wherever the
  // teacher's device is right now. checkLocation: false switches the check off.
  let latitude: number | null = null;
  let longitude: number | null = null;
  let locationSource: "venue" | "device" | null = null;
  if (body.checkLocation !== false) {
    if (cls.venueLatitude != null && cls.venueLongitude != null) {
      latitude = cls.venueLatitude;
      longitude = cls.venueLongitude;
      locationSource = "venue";
    } else if (typeof body.latitude === "number" && typeof body.longitude === "number") {
      latitude = body.latitude;
      longitude = body.longitude;
      locationSource = "device";
    }
  }

  const session = await prisma.attendanceSession.create({
    data: {
      classId,
      date: startOfToday(),
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
      latitude,
      longitude,
    },
  });
  return NextResponse.json({ ...session, locationSource }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return auth.response;

  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });
  if (!(await canManageClass(auth.user, classId))) {
    return NextResponse.json({ error: "This isn't your class" }, { status: 403 });
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { classId, date: dayRange(todayKey()), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(session);
}