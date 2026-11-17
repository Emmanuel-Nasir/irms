import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  decryptSecret, encryptSecret, hashRecoveryCode, newRecoveryCodes, newSecret, otpauthUri, verifyCode,
} from "@/lib/totp";

async function me() {
  const current = await getCurrentUser();
  if (!current) return null;
  return prisma.user.findUnique({ where: { id: current.userId } });
}

// Whether two-step sign-in is on, and how many recovery codes are left
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  return NextResponse.json({
    enabled: !!user.totpEnabledAt,
    enabledAt: user.totpEnabledAt,
    recoveryCodesLeft: user.recoveryCodes.length,
    required: user.role === "SUPER_ADMIN",
  });
}

/**
 * action "start":   make a new secret and return the QR details (not switched on yet)
 * action "confirm": check the first code from the app, switch it on, return recovery codes (shown once)
 * action "disable": needs password and a current code
 * action "new-codes": new recovery codes; needs a current code
 */
export async function POST(req: NextRequest) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const actor = { id: user.id, name: user.name };

  if (body.action === "start") {
    if (user.totpEnabledAt) {
      return NextResponse.json({ error: "Two-step sign-in is already on." }, { status: 400 });
    }
    const secret = newSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: encryptSecret(secret), totpLastStep: null } });
    return NextResponse.json({ secret, uri: otpauthUri(secret, user.email) });
  }

  if (body.action === "confirm") {
    if (user.totpEnabledAt || !user.totpSecret) {
      return NextResponse.json({ error: "Start the setup first." }, { status: 400 });
    }
    const step = verifyCode(decryptSecret(user.totpSecret), String(body.code ?? ""));
    if (step === null) {
      return NextResponse.json({ error: "That code isn't right. Check the time on your phone and try the newest code." }, { status: 400 });
    }
    const codes = newRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: codes.map(hashRecoveryCode) },
    });
    await audit(actor, "TWO_FACTOR_ON", `${user.name} switched on two-step sign-in`, user.id);
    return NextResponse.json({ enabled: true, recoveryCodes: codes });
  }

  if (body.action === "disable" || body.action === "new-codes") {
    if (!user.totpEnabledAt || !user.totpSecret) {
      return NextResponse.json({ error: "Two-step sign-in isn't on." }, { status: 400 });
    }
    const step = verifyCode(decryptSecret(user.totpSecret), String(body.code ?? ""), user.totpLastStep);
    if (step === null) return NextResponse.json({ error: "That code isn't right." }, { status: 400 });

    if (body.action === "new-codes") {
      const codes = newRecoveryCodes();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpLastStep: step, recoveryCodes: codes.map(hashRecoveryCode) },
      });
      await audit(actor, "TWO_FACTOR_CODES", `${user.name} made new recovery codes`, user.id);
      return NextResponse.json({ recoveryCodes: codes });
    }

    if (typeof body.password !== "string" || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Your password is incorrect." }, { status: 401 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] },
    });
    await audit(actor, "TWO_FACTOR_OFF", `${user.name} switched off two-step sign-in`, user.id);
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
