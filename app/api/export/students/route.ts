import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  const stakeFilter = req.nextUrl.searchParams.get("stake");
  const classFilter = req.nextUrl.searchParams.get("classId");

  const students = await prisma.student.findMany({
    where: stakeFilter ? { stake: stakeFilter } : undefined,
    include: {
      user: true,
      enrollments: { include: { class: true } },
      graduationProgress: true,
    },
    orderBy: { user: { name: "asc" } },
  });

  const rows = [
    ["Name", "Email", "Ward", "Stake", "Phone", "Classes", "Core Credits", "Elective Credits"],
  ];

  for (const s of students) {
    let enrollments = s.enrollments;
    if (classFilter) {
      enrollments = enrollments.filter((e) => e.classId === classFilter);
      if (enrollments.length === 0) continue;
    }

    const classNames = enrollments.map((e) => e.class.name).join("; ");
    const core = s.graduationProgress
      ? `${s.graduationProgress.coreCreditsCompleted}/${s.graduationProgress.coreCreditsRequired}`
      : "";
    const elective = s.graduationProgress
      ? `${s.graduationProgress.electiveCreditsCompleted}/${s.graduationProgress.electiveCreditsRequired}`
      : "";

    rows.push([
      s.user.name,
      s.user.email,
      s.ward ?? "",
      s.stake ?? "",
      s.phone ?? "",
      classNames,
      core,
      elective,
    ]);
  }

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="irms-students-export.csv"`,
    },
  });
}