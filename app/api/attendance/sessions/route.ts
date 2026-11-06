import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS } from "@/lib/permissions";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return auth.response;

  const { classId, latitude, longitude } = await req.json();
  if (!classId) return NextResponse.json({ error: "classId is required" }, { status: 400 });
  if (!(await canManageClass(auth.user, classId))) {
    return NextResponse.json({ error: "This isn't your class" }, { status: 403 });
  }

  const session = await prisma.attendanceSession.create({
    data: {
      classId,
      date: startOfToday(),
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60 * 1000),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    },
  });
  return NextResponse.json(session, { status: 201 });
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
    where: { classId, date: startOfToday(), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(session);
}