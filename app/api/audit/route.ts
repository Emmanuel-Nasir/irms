import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

const PAGE_SIZE = 50;

// The activity log, newest first. Filters: q (text), action, page.
export async function GET(req: NextRequest) {
  const auth = await requireRole([]);
  if (!auth.ok) return auth.response;

  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const action = (params.get("action") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);

  const where = {
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" as const } },
            { actorName: { contains: q, mode: "insensitive" as const } },
            { ip: { contains: q } },
          ],
        }
      : {}),
  };

  const [entries, total, actions] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
  ]);

  return NextResponse.json({
    entries,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
  });
}
