import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ALL_ROLES, STAFF, stakeScope } from "@/lib/permissions";
import { classAccess } from "@/lib/classAccess";
import { audit } from "@/lib/audit";

/**
 * Leaders post to everyone, a stake or a class. Teachers post to their own classes.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole([...STAFF, "TEACHER"]);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const classId = typeof body.classId === "string" && body.classId ? body.classId : null;
  let targetStake = typeof body.targetStake === "string" && body.targetStake.trim() ? body.targetStake.trim() : null;

  if (title.length < 2 || title.length > 150) return NextResponse.json({ error: "Give it a title (2 to 150 characters)" }, { status: 400 });
  if (text.length < 2 || text.length > 4000) return NextResponse.json({ error: "Write the message (up to 4,000 characters)" }, { status: 400 });

  if (auth.user.role === "TEACHER") {
    if (!classId) return NextResponse.json({ error: "Teachers post to one of their classes" }, { status: 400 });
    targetStake = null;
  }
  if (classId && !(await classAccess(auth.user, classId)).canEdit) {
    return NextResponse.json({ error: "You can't post to that class" }, { status: 403 });
  }
  // Leaders limited to a stake post to their own stake
  const scope = stakeScope(auth.user);
  if (scope && !classId) targetStake = scope;

  const announcement = await prisma.announcement.create({
    data: { title, body: text, authorId: auth.user.id, classId, targetStake },
    include: { author: { select: { name: true } }, class: { select: { name: true } } },
  });
  await audit(
    auth.user,
    "ANNOUNCEMENT_POSTED",
    `${auth.user.name} posted "${title}"${announcement.class ? ` to ${announcement.class.name}` : targetStake ? ` to ${targetStake}` : " to everyone"}`,
    announcement.id
  );
  return NextResponse.json(announcement, { status: 201 });
}

// ?classId=... for one class's announcements
export async function GET(req: NextRequest) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;

  const onlyClass = req.nextUrl.searchParams.get("classId");
  if (onlyClass) {
    if (!(await classAccess(auth.user, onlyClass)).canView) {
      return NextResponse.json({ error: "You can't open this class" }, { status: 403 });
    }
    const items = await prisma.announcement.findMany({
      where: { classId: onlyClass },
      include: { author: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items.map((a) => ({ ...a, mine: a.authorId === auth.user.id })));
  }

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
      AND: [{ OR: [{ classId: null }, { classId: { in: classIds } }] }, { OR: stakeOptions }],
    };
  } else {
    const scope = stakeScope(auth.user);
    if (scope) where = { OR: [{ targetStake: null }, { targetStake: scope }] };
  }

  const announcements = await prisma.announcement.findMany({
    where,
    include: { author: { select: { name: true } }, class: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(announcements.map((a) => ({ ...a, mine: a.authorId === auth.user.id })));
}
