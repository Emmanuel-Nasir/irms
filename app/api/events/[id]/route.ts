import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, STAFF, stakeScope, type AuthUser } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { readEvent } from "@/lib/eventInput";

// Stake-limited leaders may only change events they planned themselves
async function editable(user: AuthUser, id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (user.role !== "SUPER_ADMIN" && stakeScope(user) && event.createdById !== user.id) {
    return NextResponse.json({ error: "Only the person who planned this event can change it" }, { status: 403 });
  }
  return event;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const found = await editable(auth.user, id);
  if (found instanceof NextResponse) return found;

  const body = await req.json().catch(() => ({}));
  const input = readEvent(body, found);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  await prisma.event.update({ where: { id }, data: input.value });
  await audit(auth.user, "EVENT_UPDATED", `Updated "${input.value.title}"`, id);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(STAFF);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const found = await editable(auth.user, id);
  if (found instanceof NextResponse) return found;

  await prisma.$transaction([
    prisma.eventRsvp.deleteMany({ where: { eventId: id } }),
    prisma.event.delete({ where: { id } }),
  ]);
  await audit(auth.user, "EVENT_DELETED", `Cancelled "${found.title}"`, id);
  return NextResponse.json({ success: true });
}
