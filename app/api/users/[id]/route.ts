import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireRole, type AppRole } from "@/lib/permissions";

const SWITCHABLE = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { name, email, role, newPassword } = await req.json();

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const data: { name?: string; email?: string; role?: AppRole; passwordHash?: string } = {};

  if (name) data.name = name;

  if (email && email !== target.email) {
    if (await prisma.user.findUnique({ where: { email } })) {
      return NextResponse.json({ error: "That email is already used" }, { status: 409 });
    }
    data.email = email;
  }

  if (role && role !== target.role) {
    if (id === auth.user.id) {
      return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
    }
    if (!SWITCHABLE.includes(target.role) || !SWITCHABLE.includes(role)) {
      return NextResponse.json(
        { error: "Teacher and Student accounts can't be converted. Delete and re-add them instead." },
        { status: 400 }
      );
    }
    data.role = role as AppRole;
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (id === auth.user.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, include: { student: true, teacher: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (target.student) {
      const sid = target.student.id;
      await tx.attendance.deleteMany({ where: { studentId: sid } });
      await tx.enrollment.deleteMany({ where: { studentId: sid } });
      await tx.eventRsvp.deleteMany({ where: { studentId: sid } });
      await tx.graduationProgress.deleteMany({ where: { studentId: sid } });
      await tx.student.delete({ where: { id: sid } });
    }
    if (target.teacher) {
      await tx.class.updateMany({ where: { teacherId: target.teacher.id }, data: { teacherId: null } });
      await tx.teacher.delete({ where: { id: target.teacher.id } });
    }
    // Keep what they posted, now credited to you
    await tx.announcement.updateMany({ where: { authorId: id }, data: { authorId: auth.user.id } });
    await tx.event.updateMany({ where: { createdById: id }, data: { createdById: auth.user.id } });
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}