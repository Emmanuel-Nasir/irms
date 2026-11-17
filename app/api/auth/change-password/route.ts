import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, startSession } from "@/lib/auth";
import { passwordProblem } from "@/lib/passwords";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: currentUser.userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const problem = passwordProblem(newPassword, { name: user.name, email: user.email });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Choose a password different from your current one" }, { status: 400 });
  }

  // A new session version signs this account out everywhere else; this device stays signed in
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 }, mustChangePassword: false },
  });

  await audit({ id: user.id, name: user.name }, "PASSWORD_CHANGED", `${user.name} changed their password`, user.id);
  const response = NextResponse.json({ success: true });
  startSession(response, updated);
  return response;
}
