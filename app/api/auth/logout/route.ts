import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  endSession(response);
  return response;
}
