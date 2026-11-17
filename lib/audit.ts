import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; name: string } | null;

export async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

/**
 * Records who did what. Never throws: a failed log entry must not stop the action itself.
 * Keep summaries free of passwords, codes and other secrets.
 */
export async function audit(actor: Actor, action: string, summary: string, targetId?: string | null) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? "Someone not signed in",
        action,
        summary: summary.slice(0, 500),
        targetId: targetId ?? null,
        ip: await requestIp(),
      },
    });
  } catch (err) {
    console.error("Couldn't write the activity log", err);
  }
}
