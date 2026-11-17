import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "token";
const SESSION_DAYS = 7;

type TokenPayload = {
  userId: string;
  role: string;
};

type SignedToken = TokenPayload & { sv?: number };

function secret(): string | null {
  const s = process.env.JWT_SECRET;
  return s && s.length >= 16 ? s : null;
}

// The signed-in user, or null. Checks the token's signature and that the account still
// exists and hasn't changed its password since this token was issued.
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const key = secret();
  if (!key) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload: SignedToken;
  try {
    payload = jwt.verify(token, key, { algorithms: ["HS256"] }) as SignedToken;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== (payload.sv ?? 0)) return null;

  return { userId: user.id, role: user.role };
}

// Signs the user in on this device by setting the session cookie on the response
// Super admins are signed out after 12 hours; everyone else after 7 days
function sessionSeconds(role: string) {
  return role === "SUPER_ADMIN" ? 60 * 60 * 12 : 60 * 60 * 24 * SESSION_DAYS;
}

export function startSession(
  response: NextResponse,
  user: { id: string; role: string; sessionVersion: number }
): boolean {
  const key = secret();
  if (!key) return false;
  const seconds = sessionSeconds(user.role);
  const token = jwt.sign({ userId: user.id, role: user.role, sv: user.sessionVersion }, key, {
    algorithm: "HS256",
    expiresIn: seconds,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" (not "strict") so opening a QR check-in link from another app keeps you signed in
    sameSite: "lax",
    maxAge: seconds,
    path: "/",
  });
  return true;
}

// After a correct password, accounts with two-step sign-in get this short-lived pass
// (5 minutes) instead of a session. It's only good for entering the code.
export function makeTwoFactorChallenge(user: { id: string; sessionVersion: number }): string | null {
  const key = secret();
  if (!key) return null;
  return jwt.sign({ uid: user.id, sv: user.sessionVersion, purpose: "2fa" }, key, {
    algorithm: "HS256",
    expiresIn: 300,
  });
}

export function readTwoFactorChallenge(challenge: unknown): { uid: string; sv: number } | null {
  const key = secret();
  if (!key || typeof challenge !== "string") return null;
  try {
    const p = jwt.verify(challenge, key, { algorithms: ["HS256"] }) as { uid?: string; sv?: number; purpose?: string };
    return p.purpose === "2fa" && p.uid ? { uid: p.uid, sv: p.sv ?? 0 } : null;
  } catch {
    return null;
  }
}

export function endSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
