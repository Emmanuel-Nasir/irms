import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { makeTwoFactorChallenge, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Per account: after 5 wrong passwords in a row the account waits 15 minutes.
// A super admin resetting the password lifts the wait.
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// Per network address: at most 20 failed attempts in 15 minutes, across all accounts,
// so one person can't try a password against many accounts.
const IP_MAX_FAILED = 20;
const IP_WINDOW_MINUTES = 15;

// Compared against when the email doesn't exist, so a wrong email takes as long as a
// wrong password and the response time doesn't reveal which emails have accounts
const DUMMY_HASH = "$2b$10$4/8tW6XuNyAv0lOSn6yLl.I3WH25VJ8VEivQUNmcgYY4NAqueoUcO";

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooMany(minutes: number, who: "account" | "network") {
  const wait = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  return NextResponse.json(
    {
      error:
        who === "account"
          ? `Too many wrong passwords. Try again in ${wait}, or ask your coordinator to reset your password.`
          : `Too many sign-in attempts from this network. Please wait ${wait} and try again.`,
      code: "LOCKED",
    },
    { status: 429, headers: { "Retry-After": String(minutes * 60) } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const ip = clientIp(req);
  const since = new Date(Date.now() - IP_WINDOW_MINUTES * 60000);
  const ipFailures = await prisma.loginAttempt.count({
    where: { ip, success: false, createdAt: { gte: since } },
  });
  if (ipFailures >= IP_MAX_FAILED) return tooMany(IP_WINDOW_MINUTES, "network");

  // Phones often capitalise the first letter: match the email without caring about case
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return tooMany(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000), "account");
  }

  let valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  // A password pasted from a chat often has a trailing space or line break
  if (!valid && user && password.trim() !== password) {
    valid = await bcrypt.compare(password.trim(), user.passwordHash);
  }

  await prisma.loginAttempt.create({ data: { ip, success: !!user && valid } });
  // Now and then, clear attempts older than a day so the table stays small
  if (Math.random() < 0.05) {
    prisma.loginAttempt
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400000) } } })
      .catch(() => {});
  }

  if (!user || !valid) {
    if (user) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED;
      await prisma.user.update({
        where: { id: user.id },
        data: lock
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) }
          : { failedLoginCount: failed },
      });
      if (lock) {
        await audit(null, "ACCOUNT_LOCKED", `${user.name}'s account was locked after ${MAX_FAILED} wrong passwords`, user.id);
      }
    }
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  // Two-step sign-in: the password was right, now ask for the code from their app
  if (user.totpEnabledAt) {
    const challenge = makeTwoFactorChallenge(user);
    if (!challenge) {
      return NextResponse.json({ error: "The server isn't set up correctly. Please tell the administrator." }, { status: 500 });
    }
    return NextResponse.json({ twoFactor: true, challenge, name: user.name.split(" ")[0] });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ id: user.id, name: user.name }, "SIGN_IN", `${user.name} signed in`, user.id);

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  if (!startSession(response, user)) {
    console.error("JWT_SECRET is missing or shorter than 16 characters");
    return NextResponse.json(
      { error: "The server isn't set up correctly. Please tell the administrator." },
      { status: 500 }
    );
  }
  return response;
}
