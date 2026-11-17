import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readTwoFactorChallenge, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { decryptSecret, hashRecoveryCode, verifyCode } from "@/lib/totp";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// Second step of sign-in: the 6-digit code from the authenticator app, or a recovery code
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pass = readTwoFactorChallenge(body.challenge);
  if (!pass) {
    return NextResponse.json({ error: "That took too long. Please sign in again.", code: "RESTART" }, { status: 401 });
  }
  const code = typeof body.code === "string" ? body.code.trim().slice(0, 20) : "";

  const user = await prisma.user.findUnique({ where: { id: pass.uid } });
  if (!user || !user.totpSecret || !user.totpEnabledAt || user.sessionVersion !== pass.sv) {
    return NextResponse.json({ error: "Please sign in again.", code: "RESTART" }, { status: 401 });
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: "Too many wrong codes. Try again later, or ask another super admin for help.", code: "LOCKED" },
      { status: 429 }
    );
  }

  let ok = false;
  let usedRecovery = false;
  const step = verifyCode(decryptSecret(user.totpSecret), code, user.totpLastStep);
  if (step !== null) {
    ok = true;
    await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
  } else if (code.replace(/[\s-]/g, "").length >= 10) {
    const hash = hashRecoveryCode(code);
    if (user.recoveryCodes.includes(hash)) {
      ok = true;
      usedRecovery = true;
      // Each recovery code works once
      await prisma.user.update({
        where: { id: user.id },
        data: { recoveryCodes: user.recoveryCodes.filter((c) => c !== hash) },
      });
    }
  }

  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED;
    await prisma.user.update({
      where: { id: user.id },
      data: lock
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) }
        : { failedLoginCount: failed },
    });
    if (lock) await audit(null, "ACCOUNT_LOCKED", `${user.name}'s account was locked after ${MAX_FAILED} wrong codes`, user.id);
    return NextResponse.json({ error: "That code isn't right. Check your app and try again." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await audit(
    { id: user.id, name: user.name },
    "SIGN_IN",
    `${user.name} signed in with two-step sign-in${usedRecovery ? " (used a recovery code)" : ""}`,
    user.id
  );

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
    recoveryCodesLeft: usedRecovery ? user.recoveryCodes.length - 1 : undefined,
  });
  startSession(response, user);
  return response;
}
