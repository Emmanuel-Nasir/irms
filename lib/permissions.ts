import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ALL_ROLES = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"] as const;
export type AppRole = (typeof ALL_ROLES)[number];

export const STAFF: AppRole[] = ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];
export const CLASS_MANAGERS: AppRole[] = [...STAFF, "TEACHER"];

type AuthResult =
  | { ok: true; user: { id: string; name: string; role: AppRole } }
  | { ok: false; response: NextResponse };

// SUPER_ADMIN always passes. Pass [] for "super admin only".
export async function requireRole(allowed: readonly AppRole[]): Promise<AuthResult> {
  const token = await getCurrentUser();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "You must be logged in" }, { status: 401 }) };
  }

  // Read the role from the database, not the token, so changes apply immediately
  const user = await prisma.user.findUnique({
    where: { id: token.userId },
    select: { id: true, name: true, role: true },
  });
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Account no longer exists" }, { status: 401 }) };
  }

  const role = user.role as AppRole;
  if (role !== "SUPER_ADMIN" && !allowed.includes(role)) {
    return { ok: false, response: NextResponse.json({ error: "You don't have permission to do that" }, { status: 403 }) };
  }
  return { ok: true, user: { id: user.id, name: user.name, role } };
}

// Teachers may only touch classes assigned to them. Staff can touch any class.
export async function canManageClass(user: { id: string; role: AppRole }, classId: string) {
  if (user.role !== "TEACHER") return true;
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
  if (!teacher) return false;
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { teacherId: true } });
  return cls?.teacherId === teacher.id;
}