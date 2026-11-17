import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { confirmPassword, requireRole, type AppRole } from "@/lib/permissions";
import { passwordProblem } from "@/lib/passwords";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

const SWITCHABLE = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];

async function superAdminCount() {
  return prisma.user.count({ where: { role: "SUPER_ADMIN" } });
}

/**
 * Change one account. Fields: name, email, stake, role, newPassword, unlock, signOut.
 * Changing a role or someone's password also needs confirmPassword (your own password).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const target = await prisma.user.findUnique({ where: { id }, include: { student: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const data: {
    name?: string;
    email?: string;
    stake?: string | null;
    role?: AppRole;
    passwordHash?: string;
    failedLoginCount?: number;
    lockedUntil?: Date | null;
    sessionVersion?: { increment: number };
    mustChangePassword?: boolean;
  } = {};
  const changes: string[] = [];

  if (body.role !== undefined || body.newPassword !== undefined) {
    const denied = await confirmPassword(auth.user.id, body.confirmPassword);
    if (denied) return denied;
  }

  if (body.name !== undefined) {
    const r = v.name(body.name);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    if (r.value !== target.name) {
      data.name = r.value;
      changes.push(`name to ${r.value}`);
    }
  }

  if (body.email !== undefined) {
    const r = v.email(body.email);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    if (r.value !== target.email.toLowerCase()) {
      const clash = await prisma.user.findFirst({
        where: { email: { equals: r.value, mode: "insensitive" }, NOT: { id } },
      });
      if (clash) return NextResponse.json({ error: "That email is already used" }, { status: 409 });
      data.email = r.value;
      changes.push(`email to ${r.value}`);
    }
  }

  if (body.stake !== undefined) {
    const r = v.optionalText(body.stake, "Stake");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    if (target.student) {
      await prisma.student.update({ where: { id: target.student.id }, data: { stake: r.value } });
    } else {
      data.stake = r.value;
    }
    changes.push(r.value ? `stake to ${r.value}` : "stake to none");
  }

  if (body.role !== undefined && body.role !== target.role) {
    if (id === auth.user.id) {
      return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
    }
    if (!SWITCHABLE.includes(target.role) || !SWITCHABLE.includes(body.role)) {
      return NextResponse.json(
        { error: "Teacher and Student accounts can't be converted. Delete and re-add them instead." },
        { status: 400 }
      );
    }
    if (target.role === "SUPER_ADMIN" && (await superAdminCount()) <= 1) {
      return NextResponse.json({ error: "IRMS needs at least one super admin." }, { status: 400 });
    }
    data.role = body.role as AppRole;
    data.sessionVersion = { increment: 1 }; // sign them in again with the new role
    changes.push(`role from ${target.role} to ${body.role}`);
  }

  if (body.newPassword !== undefined) {
    const problem = passwordProblem(body.newPassword, { name: target.name, email: target.email });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    data.passwordHash = await bcrypt.hash(body.newPassword, 12);
    // A new password lifts any lock from wrong attempts and signs the account out everywhere
    data.failedLoginCount = 0;
    data.lockedUntil = null;
    data.sessionVersion = { increment: 1 };
    // They choose their own password the next time they sign in
    data.mustChangePassword = true;
    changes.push("password (reset)");
  }

  if (body.unlock === true) {
    data.failedLoginCount = 0;
    data.lockedUntil = null;
    changes.push("unlocked the account");
  }

  if (body.signOut === true) {
    data.sessionVersion = { increment: 1 };
    changes.push("signed them out on every device");
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, stake: true },
  });
  if (changes.length) {
    await audit(auth.user, "USER_CHANGED", `${auth.user.name} changed ${target.name}: ${changes.join(", ")}`, id);
  }
  return NextResponse.json(updated);
}

// Deleting an account needs your password, and the last super admin can't be deleted
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (id === auth.user.id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const denied = await confirmPassword(auth.user.id, body.confirmPassword);
  if (denied) return denied;

  const target = await prisma.user.findUnique({ where: { id }, include: { student: true, teacher: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "SUPER_ADMIN" && (await superAdminCount()) <= 1) {
    return NextResponse.json({ error: "IRMS needs at least one super admin." }, { status: 400 });
  }

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

  await audit(auth.user, "USER_DELETED", `${auth.user.name} deleted ${target.name} (${target.role}, ${target.email})`, id);
  return NextResponse.json({ success: true });
}
