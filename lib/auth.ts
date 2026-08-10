import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

type TokenPayload = {
  userId: string;
  role: string;
};

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}