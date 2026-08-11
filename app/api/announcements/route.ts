import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const { title, body, classId, targetStake } = await req.json();
  if (!title || !body) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      authorId: currentUser.userId,
      classId: classId || null,
      targetStake: targetStake || null,
    },
    include: { author: true, class: true },
  });

  return NextResponse.json(announcement, { status: 201 });
}

export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get("classId");
  const stake = req.nextUrl.searchParams.get("stake");

  const conditions: Record<string, unknown>[] = [
    { AND: [{ classId: null }, { targetStake: null }] }, // true stake-wide, everyone
  ];
  if (classId) conditions.push({ classId });
  if (stake) conditions.push({ targetStake: stake });

  const announcements = await prisma.announcement.findMany({
    where: { OR: conditions },
    include: { author: true, class: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(announcements);
}