import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole, STAFF } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// The author, or any leader, can correct an announcement
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const a = await prisma.announcement.findUnique({ where: { id }, select: { authorId: true, title: true } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const leader = auth.user.role === "SUPER_ADMIN" || STAFF.includes(auth.user.role);
  if (a.authorId !== auth.user.id && !leader) {
    return NextResponse.json({ error: "You can only edit your own announcements" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (title.length < 2 || title.length > 150) return NextResponse.json({ error: "Give it a title (2 to 150 characters)" }, { status: 400 });
  if (text.length < 2 || text.length > 4000) return NextResponse.json({ error: "Write the message (up to 4,000 characters)" }, { status: 400 });
  const updated = await prisma.announcement.update({ where: { id }, data: { title, body: text } });
  await audit(auth.user, "ANNOUNCEMENT_POSTED", `${auth.user.name} edited the announcement "${title}"`, id);
  return NextResponse.json(updated);
}

// The author, or any leader, can take an announcement down
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const a = await prisma.announcement.findUnique({ where: { id }, select: { authorId: true, title: true } });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const leader = auth.user.role === "SUPER_ADMIN" || STAFF.includes(auth.user.role);
  if (a.authorId !== auth.user.id && !leader) {
    return NextResponse.json({ error: "You can only remove your own announcements" }, { status: 403 });
  }
  await prisma.announcement.delete({ where: { id } });
  await audit(auth.user, "ANNOUNCEMENT_REMOVED", `${auth.user.name} removed the announcement "${a.title}"`, id);
  return NextResponse.json({ success: true });
}
