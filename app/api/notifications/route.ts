import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationsFor } from "@/lib/notifications";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });
  return NextResponse.json(await notificationsFor(current.userId));
}

// { action: "seen" } marks everything up to now as read
export async function POST(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== "seen") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  await prisma.user.update({ where: { id: current.userId }, data: { notificationsSeenAt: new Date() } });
  return NextResponse.json({ success: true });
}
