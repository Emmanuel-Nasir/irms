import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(req: NextRequest) {
  const { classId, latitude, longitude } = await req.json();
  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds — rotating

  const session = await prisma.attendanceSession.create({
    data: {
      classId,
      date: startOfToday(),
      token,
      expiresAt,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    },
  });

  return NextResponse.json(session, { status: 201 });
}

export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }
  const session = await prisma.attendanceSession.findFirst({
    where: { classId, date: startOfToday(), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(session);
}