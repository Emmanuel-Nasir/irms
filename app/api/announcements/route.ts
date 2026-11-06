import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ALL_ROLES, STAFF } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { title, body, classId, targetStake } = await req.json();
  if (!title || !body) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: { title, body, authorId: auth.user.id, classId: classId || null, targetStake: targetStake || null },
    include: { author: { select: { name: true } }, class: { select: { name: true } } },
  });
  return NextResponse.json(announcement, { status: 201 });
}

export async function GET() {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;

  const role = auth.user.role;
  let where = {}; // admins see everything

  if (role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: auth.user.id },
      include: { classes: { select: { id: true } } },
    });
    const classIds = teacher?.classes.map((c) => c.id) ?? [];
    where = { OR: [{ classId: null }, { classId: { in: classIds } }] };
  } else if (role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: auth.user.id },
      include: { enrollments: { select: { classId: true } } },
    });
    if (!student) return NextResponse.json([]);
    const classIds = student.enrollments.map((e) => e.classId);
    const stakeOptions: { targetStake: string | null }[] = [{ targetStake: null }];
    if (student.stake) stakeOptions.push({ targetStake: student.stake });
    where = {
      AND: [
        { OR: [{ classId: null }, { classId: { in: classIds } }] },
        { OR: stakeOptions },
      ],
    };
  }

  const announcements = await prisma.announcement.findMany({
    where,
    include: { author: { select: { name: true } }, class: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(announcements);
}