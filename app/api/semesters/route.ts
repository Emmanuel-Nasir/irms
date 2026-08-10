import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name, startDate, endDate } = await req.json();

  if (!name || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Name, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  const semester = await prisma.semester.create({
    data: { name, startDate: new Date(startDate), endDate: new Date(endDate) },
  });

  return NextResponse.json(semester, { status: 201 });
}

export async function GET() {
  const semesters = await prisma.semester.findMany({
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(semesters);
}