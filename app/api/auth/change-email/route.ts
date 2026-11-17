import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Change your own sign-in email. Needs your current password, so someone who finds
// your phone signed in can't take over the account.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: currentUser.userId } });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Your current password is incorrect" }, { status: 401 });
  }

  const clash = await prisma.user.findFirst({
    where: { email: { equals: newEmail, mode: "insensitive" }, NOT: { id: user.id } },
  });
  if (clash) return NextResponse.json({ error: "That email is already used by another account" }, { status: 409 });

  await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
  return NextResponse.json({ email: newEmail });
}
