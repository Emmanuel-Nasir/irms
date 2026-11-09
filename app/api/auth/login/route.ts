import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  }

  // Phones often capitalise the first letter: match the email without caring about case
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  let valid = false;
  if (user) {
    valid = await bcrypt.compare(password, user.passwordHash);
    // A password pasted from a chat often has a trailing space or line break
    if (!valid && password.trim() !== password) {
      valid = await bcrypt.compare(password.trim(), user.passwordHash);
    }
  }

  if (!user || !valid) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set");
    return NextResponse.json(
      { error: "The server isn't set up correctly. Please tell the administrator." },
      { status: 500 }
    );
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: "7d" });

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}