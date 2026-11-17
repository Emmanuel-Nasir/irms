import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPassword, requireRole } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/**
 * A full copy of the IRMS records as one JSON file, for safekeeping.
 * Passwords, two-step secrets and recovery codes are left out, so the file can't be
 * used to sign in as anyone. It still holds members' personal details: store it safely.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const denied = await confirmPassword(auth.user.id, body.confirmPassword);
  if (denied) return denied;

  const [users, students, teachers, semesters, classes, enrollments, attendance, graduation, announcements, events, rsvps, resources] =
    await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, stake: true, createdAt: true, lastLoginAt: true },
      }),
      prisma.student.findMany(),
      prisma.teacher.findMany(),
      prisma.semester.findMany(),
      prisma.class.findMany(),
      prisma.enrollment.findMany(),
      prisma.attendance.findMany(),
      prisma.graduationProgress.findMany(),
      prisma.announcement.findMany(),
      prisma.event.findMany(),
      prisma.eventRsvp.findMany(),
      prisma.resource.findMany(),
    ]);

  const backup = {
    app: "IRMS",
    createdAt: new Date().toISOString(),
    createdBy: auth.user.name,
    note: "Passwords, two-step secrets and recovery codes are not included.",
    counts: {
      users: users.length, students: students.length, teachers: teachers.length, semesters: semesters.length,
      classes: classes.length, enrollments: enrollments.length, attendance: attendance.length,
    },
    data: { users, students, teachers, semesters, classes, enrollments, attendance, graduation, announcements, events, rsvps, resources },
  };

  await audit(auth.user, "BACKUP_DOWNLOADED", `${auth.user.name} downloaded a full backup (${users.length} accounts, ${attendance.length} attendance records)`);

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="irms-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
