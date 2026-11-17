import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/permissions";

const STAFF_ROLES = ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];

export type ClassAccess = { canView: boolean; canEdit: boolean; studentId: string | null };

/**
 * Who may open a class's page, and who may change it:
 * leaders and the class's own teacher can view and edit; enrolled students can view.
 */
export async function classAccess(user: AuthUser, classId: string): Promise<ClassAccess> {
  const none = { canView: false, canEdit: false, studentId: null };
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { teacherId: true } });
  if (!cls) return none;

  if (STAFF_ROLES.includes(user.role)) return { canView: true, canEdit: true, studentId: null };

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    const mine = !!teacher && cls.teacherId === teacher.id;
    return { canView: mine, canEdit: mine, studentId: null };
  }

  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) return none;
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId: student.id, classId } },
      select: { status: true },
    });
    const ok = !!enrolled && enrolled.status !== "DROPPED";
    return { canView: ok, canEdit: false, studentId: ok ? student.id : null };
  }

  return none;
}
