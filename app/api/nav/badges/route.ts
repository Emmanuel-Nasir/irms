import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { dayRange, todayKey } from "@/lib/dates";
import { weekday } from "@/lib/stats";

// Small numbers shown beside menu items. Keyed by the menu item's address.
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({});

  const user = await prisma.user.findUnique({
    where: { id: current.userId },
    select: { role: true, totpEnabledAt: true, teacher: { select: { id: true } }, student: { select: { id: true } } },
  });
  if (!user) return NextResponse.json({});

  const today = todayKey();
  const dow = weekday(today);
  const badges: Record<string, { count: number; tone: "gold" | "clay" | "sage"; hint: string }> = {};

  if (user.role === "SUPER_ADMIN") {
    if (!user.totpEnabledAt) {
      // Their own two-step sign-in comes first: the Security Centre stays locked until then
      badges["/dashboard/security"] = { count: 1, tone: "clay", hint: "Switch on two-step sign-in" };
    } else {
      // The same checks the Security Centre's "things to look at" counts
      const [locked, no2fa, noStake, failed] = await Promise.all([
        prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
        prisma.user.count({ where: { role: { in: ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN"] }, totpEnabledAt: null } }),
        prisma.user.count({ where: { role: { in: ["STAKE_ADMIN", "COORDINATOR"] }, OR: [{ stake: null }, { stake: "" }] } }),
        prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
      ]);
      const issues = [locked > 0, no2fa > 0, noStake > 0, failed >= 20].filter(Boolean).length;
      if (issues) badges["/dashboard/security"] = { count: issues, tone: "clay", hint: "Things to look at" };
    }
  }

  if (user.role === "TEACHER" && user.teacher) {
    const n = await prisma.class.count({ where: { teacherId: user.teacher.id, archived: false, dayOfWeek: dow } });
    if (n) badges["/dashboard/my-classes"] = { count: n, tone: "gold", hint: "Classes today" };
  }

  if (user.role === "STUDENT" && user.student) {
    const enrolled = await prisma.enrollment.findMany({
      where: { studentId: user.student.id, status: { not: "DROPPED" }, class: { dayOfWeek: dow, archived: false } },
      select: { classId: true },
    });
    if (enrolled.length) {
      const done = await prisma.attendance.count({
        where: {
          studentId: user.student.id,
          classId: { in: enrolled.map((e) => e.classId) },
          date: dayRange(today),
          status: { in: ["PRESENT", "LATE"] },
        },
      });
      const left = enrolled.length - done;
      if (left > 0) badges["/dashboard/my-schedule"] = { count: left, tone: "gold", hint: "Check-ins left today" };
    }
  }

  if (["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"].includes(user.role)) {
    const n = await prisma.class.count({ where: { archived: false, dayOfWeek: dow } });
    if (n) badges["/dashboard/classes"] = { count: n, tone: "sage", hint: "Classes today" };
  }

  return NextResponse.json(badges);
}
