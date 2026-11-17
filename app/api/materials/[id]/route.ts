import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole } from "@/lib/permissions";
import { classAccess } from "@/lib/classAccess";
import { audit } from "@/lib/audit";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const resource = await prisma.resource.findUnique({ where: { id }, select: { classId: true, title: true } });
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await classAccess(auth.user, resource.classId)).canEdit) {
    return NextResponse.json({ error: "You can't remove this" }, { status: 403 });
  }
  await prisma.resource.delete({ where: { id } }); // the file goes with it
  await audit(auth.user, "MATERIAL_REMOVED", `${auth.user.name} removed "${resource.title}"`, id);
  return NextResponse.json({ success: true });
}
