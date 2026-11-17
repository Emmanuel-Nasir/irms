import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ALL_ROLES = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"] as const;
export type AppRole = (typeof ALL_ROLES)[number];

export const STAFF: AppRole[] = ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];
export const CLASS_MANAGERS: AppRole[] = [...STAFF, "TEACHER"];

// Leaders who only see their own stake's students (once a stake is set for them)
const STAKE_LIMITED: AppRole[] = ["STAKE_ADMIN", "COORDINATOR"];

export type AuthUser = {
  id: string;
  name: string;
  role: AppRole;
  stake: string | null;
  twoFactor: boolean;
};

type AuthResult = { ok: true; user: AuthUser } | { ok: false; response: NextResponse };

// SUPER_ADMIN always passes. Pass [] for "super admin only": those actions also need
// two-step sign-in switched on, because a super admin can change everything.
export async function requireRole(allowed: readonly AppRole[]): Promise<AuthResult> {
  const token = await getCurrentUser();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "You must be logged in" }, { status: 401 }) };
  }

  // Read the role from the database, not the token, so changes apply immediately
  const user = await prisma.user.findUnique({
    where: { id: token.userId },
    select: { id: true, name: true, role: true, stake: true, totpEnabledAt: true, mustChangePassword: true },
  });
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Account no longer exists" }, { status: 401 }) };
  }

  if (user.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Choose your own password first (My Account).", code: "PASSWORD_CHANGE_REQUIRED" },
        { status: 403 }
      ),
    };
  }

  const role = user.role as AppRole;
  if (role !== "SUPER_ADMIN" && !allowed.includes(role)) {
    return { ok: false, response: NextResponse.json({ error: "You don't have permission to do that" }, { status: 403 }) };
  }
  if (allowed.length === 0 && !user.totpEnabledAt) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Super admin tools need two-step sign-in. Switch it on under My Account first.",
          code: "TWO_FACTOR_REQUIRED",
        },
        { status: 403 }
      ),
    };
  }
  return {
    ok: true,
    user: { id: user.id, name: user.name, role, stake: user.stake, twoFactor: !!user.totpEnabledAt },
  };
}

/**
 * The stake this person is limited to, or null for "all stakes".
 * Stake admins and coordinators are limited once a super admin sets their stake.
 */
export function stakeScope(user: AuthUser): string | null {
  return STAKE_LIMITED.includes(user.role) && user.stake ? user.stake : null;
}

// A Prisma filter for students this person may see
export function studentScope(user: AuthUser) {
  const stake = stakeScope(user);
  return stake ? { stake: { equals: stake, mode: "insensitive" as const } } : {};
}

// Whether this person may see or change one particular student
export async function canSeeStudent(user: AuthUser, studentId: string) {
  const stake = stakeScope(user);
  if (!stake) return true;
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { stake: true } });
  return !!student && (student.stake ?? "").toLowerCase() === stake.toLowerCase();
}

// Teachers may only touch classes assigned to them. Staff can touch any class.
export async function canManageClass(user: { id: string; role: AppRole }, classId: string) {
  if (user.role !== "TEACHER") return true;
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
  if (!teacher) return false;
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { teacherId: true } });
  return cls?.teacherId === teacher.id;
}

/**
 * For dangerous actions (deleting people, changing roles, downloading everything):
 * the person must type their password again, so an unattended signed-in screen isn't enough.
 */
export async function confirmPassword(userId: string, password: unknown): Promise<NextResponse | null> {
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Type your password to confirm.", code: "CONFIRM_PASSWORD" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "That password is incorrect.", code: "CONFIRM_PASSWORD" }, { status: 401 });
  }
  return null;
}
