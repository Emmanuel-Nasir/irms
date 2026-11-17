import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPassword, requireRole } from "@/lib/permissions";
import { audit } from "@/lib/audit";

// Security Centre: what needs attention, for super admins
export async function GET() {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const now = new Date();
  const dayAgo = new Date(Date.now() - 86400000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [byRole, locked, noStake, adminsNo2fa, failed24h, ok24h, failedByIp, recentSignIns, auditCount] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.findMany({
      where: { lockedUntil: { gt: now } },
      select: { id: true, name: true, email: true, role: true, lockedUntil: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["STAKE_ADMIN", "COORDINATOR"] }, OR: [{ stake: null }, { stake: "" }] },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "AREA_ADMIN", "STAKE_ADMIN"] }, totpEnabledAt: null },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: dayAgo } } }),
    prisma.loginAttempt.count({ where: { success: true, createdAt: { gte: dayAgo } } }),
    prisma.loginAttempt.groupBy({
      by: ["ip"],
      where: { success: false, createdAt: { gte: dayAgo } },
      _count: { _all: true },
      orderBy: { _count: { ip: "desc" } },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { action: "SIGN_IN", createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, actorName: true, summary: true, ip: true, createdAt: true },
    }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({
    you: { twoFactor: auth.user.twoFactor },
    usersByRole: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])),
    locked,
    leadersWithoutStake: noStake,
    adminsWithoutTwoFactor: adminsNo2fa,
    signIns24h: { failed: failed24h, succeeded: ok24h },
    failedByIp: failedByIp.map((f) => ({ ip: f.ip, count: f._count._all })),
    recentSignIns,
    auditCount,
  });
}

// action "sign-out-everyone": ends every session except yours (needs your password)
export async function POST(req: NextRequest) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const denied = await confirmPassword(auth.user.id, body.confirmPassword);
  if (denied) return denied;

  if (body.action === "sign-out-everyone") {
    const { count } = await prisma.user.updateMany({
      where: { NOT: { id: auth.user.id } },
      data: { sessionVersion: { increment: 1 } },
    });
    await audit(auth.user, "SIGNED_OUT_EVERYONE", `${auth.user.name} signed out all ${count} other accounts`);
    return NextResponse.json({ count });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
