import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { teacherId } = await req.json();

  const updated = await prisma.class.update({
    where: { id },
    data: { teacherId: teacherId || null },
  });

  return NextResponse.json(updated);
}