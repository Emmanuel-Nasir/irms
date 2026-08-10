import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(null);
  }
  const user = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    select: { name: true, role: true },
  });
  return NextResponse.json(user);
}