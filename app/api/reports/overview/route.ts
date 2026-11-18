import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF, stakeScope, studentScope } from "@/lib/permissions";
import { addDays, dayKey, todayKey, startOfDay } from "@/lib/dates";
import { graduationStandings } from "@/lib/graduation";

/**
 * Everything the Reports page shows, in one go:
 * a weekly trend, every class, every stake and the semesters side by side.
 * Stake-limited leaders only see their own stake's students in every number.
 *
 * "Rate" = check-ins (present or late) ÷ (enrolled students × days attendance was taken).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const limitedTo = stakeScope(auth.user);

  const params = req.nextUrl.searchParams;
  const semesters = await prisma.semester.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true, status: true } });
  const wanted = params.get("semester") ?? "active";
  const semesterId =
    wanted === "all" ? null : wanted === "active" ? semesters.find((s) => s.status === "ACTIVE")?.id ?? null : wanted;
  const weeks = Math.min(26, Math.max(4, Number(params.get("weeks")) || 12));

  const students = await prisma.student.findMany({
    where: studentScope(auth.user),
    select: { id: true, stake: true },
  });
  const studentStake = new Map(students.map((s) => [s.id, s.stake?.trim() || "Unassigned"]));
  const inScope = (id: string) => studentStake.has(id);

  const classes = await prisma.class.findMany({
    where: semesterId ? { semesterId } : {},
    select: {
      id: true,
      name: true,
      creditType: true,
      archived: true,
      semesterId: true,
      teacher: { select: { user: { select: { name: true } } } },
      enrollments: { select: { studentId: true, status: true } },
    },
    orderBy: { name: "asc" },
  });
  const classIds = classes.map((c) => c.id);

  const [sessions, records, standings] = await Promise.all([
    prisma.attendanceSession.findMany({ where: { classId: { in: classIds } }, select: { classId: true, date: true } }),
    prisma.attendance.findMany({
      where: { classId: { in: classIds } },
      select: { classId: true, studentId: true, date: true, status: true },
    }),
    graduationStandings(studentScope(auth.user)),
  ]);

  // Days attendance was actually taken, per class
  const heldDays = new Map<string, Set<string>>();
  const markHeld = (classId: string, at: Date) => {
    if (!heldDays.has(classId)) heldDays.set(classId, new Set());
    heldDays.get(classId)!.add(dayKey(at));
  };
  sessions.forEach((s) => markHeld(s.classId, s.date));
  records.forEach((r) => markHeld(r.classId, r.date));

  const attendedRecords = records.filter((r) => inScope(r.studentId) && (r.status === "PRESENT" || r.status === "LATE"));
  const atRiskByClass = new Map<string, number>();
  for (const st of standings) for (const c of st.classes) if (c.atRisk) atRiskByClass.set(c.classId, (atRiskByClass.get(c.classId) ?? 0) + 1);

  // ---- By class
  const byClass = classes
    .map((c) => {
      const enrolled = c.enrollments.filter((e) => e.status !== "DROPPED" && inScope(e.studentId));
      const held = heldDays.get(c.id)?.size ?? 0;
      const attended = attendedRecords.filter((r) => r.classId === c.id).length;
      const expected = enrolled.length * held;
      return {
        id: c.id,
        name: c.name,
        teacher: c.teacher?.user.name ?? null,
        creditType: c.creditType,
        archived: c.archived,
        enrolled: enrolled.length,
        completed: enrolled.filter((e) => e.status === "COMPLETED").length,
        heldDays: held,
        attended,
        rate: expected > 0 ? Math.min(100, Math.round((attended / expected) * 100)) : null,
        atRisk: atRiskByClass.get(c.id) ?? 0,
      };
    })
    .filter((c) => !limitedTo || c.enrolled > 0);

  // ---- Weekly trend (weeks end today)
  const today = todayKey();
  const trend: { label: string; from: string; checkins: number; rate: number | null }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const to = addDays(today, -7 * w);
    const from = addDays(to, -6);
    let checkins = 0;
    for (const r of attendedRecords) {
      const k = dayKey(r.date);
      if (k >= from && k <= to) checkins++;
    }
    let expected = 0;
    for (const c of classes) {
      const enrolled = c.enrollments.filter((e) => e.status !== "DROPPED" && inScope(e.studentId)).length;
      for (const k of heldDays.get(c.id) ?? []) if (k >= from && k <= to) expected += enrolled;
    }
    trend.push({
      label: new Date(startOfDay(from)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }),
      from,
      checkins,
      rate: expected > 0 ? Math.min(100, Math.round((checkins / expected) * 100)) : null,
    });
  }

  // ---- By stake
  const stakeRows = new Map<string, { students: number; enrolled: number; attended: number; expected: number; atRisk: number; graduated: number }>();
  const row = (stake: string) => {
    if (!stakeRows.has(stake)) stakeRows.set(stake, { students: 0, enrolled: 0, attended: 0, expected: 0, atRisk: 0, graduated: 0 });
    return stakeRows.get(stake)!;
  };
  students.forEach((s) => row(studentStake.get(s.id)!).students++);
  for (const c of classes) {
    const held = heldDays.get(c.id)?.size ?? 0;
    for (const e of c.enrollments) {
      if (e.status === "DROPPED" || !inScope(e.studentId)) continue;
      const r = row(studentStake.get(e.studentId)!);
      r.enrolled++;
      r.expected += held;
    }
  }
  attendedRecords.forEach((r) => row(studentStake.get(r.studentId)!).attended++);
  for (const st of standings) {
    const r = row(studentStake.get(st.studentId) ?? "Unassigned");
    if (st.status === "at-risk") r.atRisk++;
    if (st.graduated) r.graduated++;
  }
  const byStake = [...stakeRows.entries()]
    .map(([stake, r]) => ({
      stake,
      students: r.students,
      enrolled: r.enrolled,
      attended: r.attended,
      rate: r.expected > 0 ? Math.min(100, Math.round((r.attended / r.expected) * 100)) : null,
      atRisk: r.atRisk,
      graduated: r.graduated,
    }))
    .sort((a, b) => b.students - a.students);

  // ---- Semesters side by side (always across all semesters)
  const bySemester = await Promise.all(
    semesters.map(async (s) => {
      const cls = await prisma.class.findMany({
        where: { semesterId: s.id },
        select: { id: true, enrollments: { select: { studentId: true, status: true } } },
      });
      const ids = cls.map((c) => c.id);
      const [sess, recs] = await Promise.all([
        prisma.attendanceSession.findMany({ where: { classId: { in: ids } }, select: { classId: true, date: true } }),
        prisma.attendance.findMany({ where: { classId: { in: ids } }, select: { classId: true, studentId: true, date: true, status: true } }),
      ]);
      const held = new Map<string, Set<string>>();
      for (const x of [...sess, ...recs]) {
        if (!held.has(x.classId)) held.set(x.classId, new Set());
        held.get(x.classId)!.add(dayKey(x.date));
      }
      let expected = 0;
      let enrolled = 0;
      for (const c of cls) {
        const n = c.enrollments.filter((e) => e.status !== "DROPPED" && inScope(e.studentId)).length;
        enrolled += n;
        expected += n * (held.get(c.id)?.size ?? 0);
      }
      const attended = recs.filter((r) => inScope(r.studentId) && (r.status === "PRESENT" || r.status === "LATE")).length;
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        classes: cls.length,
        enrolled,
        rate: expected > 0 ? Math.min(100, Math.round((attended / expected) * 100)) : null,
      };
    })
  );

  const totalExpected = byClass.reduce((n, c) => n + c.enrolled * c.heldDays, 0);
  const totalAttended = byClass.reduce((n, c) => n + c.attended, 0);

  return NextResponse.json({
    scope: limitedTo,
    semesters,
    semesterId,
    totals: {
      students: students.length,
      classes: byClass.length,
      enrolled: byClass.reduce((n, c) => n + c.enrolled, 0),
      rate: totalExpected > 0 ? Math.min(100, Math.round((totalAttended / totalExpected) * 100)) : null,
      checkins: totalAttended,
      atRisk: standings.filter((s) => s.status === "at-risk").length,
      ready: standings.filter((s) => s.status === "ready").length,
      graduated: standings.filter((s) => s.graduated).length,
    },
    trend,
    byClass,
    byStake,
    bySemester,
  });
}
