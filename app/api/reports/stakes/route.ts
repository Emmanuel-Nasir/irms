import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [students, teacherCount, classCount, activeSemester] = await Promise.all([
    prisma.student.findMany({ include: { enrollments: { include: { class: true } } } }),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.semester.findFirst({ where: { status: "ACTIVE" } }),
  ]);

  const stakeMap: Record<string, { studentCount: number; classCounts: Record<string, number> }> = {};
  for (const student of students) {
    const stake = student.stake ?? "Unassigned";
    if (!stakeMap[stake]) stakeMap[stake] = { studentCount: 0, classCounts: {} };
    stakeMap[stake].studentCount++;
    for (const enrollment of student.enrollments) {
      const name = enrollment.class.name;
      stakeMap[stake].classCounts[name] = (stakeMap[stake].classCounts[name] ?? 0) + 1;
    }
  }

  const maxStudents = Math.max(1, ...Object.values(stakeMap).map((s) => s.studentCount));
  const stakes = Object.entries(stakeMap)
    .map(([stake, data]) => ({
      stake,
      studentCount: data.studentCount,
      barPct: Math.round((data.studentCount / maxStudents) * 100),
      classes: Object.entries(data.classCounts).map(([name, count]) => ({ name, count })),
    }))
    .sort((a, b) => b.studentCount - a.studentCount);

  return NextResponse.json({
    totals: {
      students: students.length,
      teachers: teacherCount,
      classes: classCount,
      stakes: stakes.length,
      activeSemester: activeSemester?.name ?? "None active",
    },
    stakes,
  });
}