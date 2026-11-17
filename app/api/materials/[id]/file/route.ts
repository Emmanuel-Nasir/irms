import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole } from "@/lib/permissions";
import { classAccess } from "@/lib/classAccess";

// Types a browser may show directly; everything else is always downloaded
const INLINE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/mp4", "text/plain"]);

// Sends an uploaded file, only to people who can open its class
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const resource = await prisma.resource.findUnique({
    where: { id },
    select: { classId: true, fileName: true, mimeType: true, kind: true, file: { select: { data: true } } },
  });
  if (!resource || resource.kind !== "FILE" || !resource.file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!(await classAccess(auth.user, resource.classId)).canView) {
    return NextResponse.json({ error: "You can't open this file" }, { status: 403 });
  }

  const type = resource.mimeType ?? "application/octet-stream";
  const name = (resource.fileName ?? "file").replace(/"/g, "");
  return new NextResponse(new Uint8Array(resource.file.data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${INLINE.has(type) ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Nothing in an uploaded file may run scripts (PDFs keep Chrome's own viewer working)
      ...(type === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'" }),
    },
  });
}
