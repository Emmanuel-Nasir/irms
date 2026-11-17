import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_ROLES, requireRole } from "@/lib/permissions";
import { classAccess } from "@/lib/classAccess";
import { audit } from "@/lib/audit";

// Files are kept in the database, so keep them small. (Vercel also refuses uploads over ~4.5 MB.)
const MAX_BYTES = 4 * 1024 * 1024;

// What may be uploaded, by extension, and the type it's served as
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

function cleanFileName(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!(await classAccess(auth.user, id)).canView) {
    return NextResponse.json({ error: "You can't open this class" }, { status: 403 });
  }
  const materials = await prisma.resource.findMany({
    where: { classId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, kind: true, fileUrl: true, fileName: true, mimeType: true, size: true, createdAt: true },
  });
  return NextResponse.json(materials);
}

/**
 * Add a material. Send multipart form data with "title", optional "description", and either
 * "link" (an https address) or "file" (up to 4 MB: PDF, Word, PowerPoint, Excel, text, images, audio).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(ALL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!(await classAccess(auth.user, id)).canEdit) {
    return NextResponse.json({ error: "Only this class's teacher or a leader can add materials" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "The upload couldn't be read. Is the file under 4 MB?" }, { status: 400 });

  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  if (title.length < 2 || title.length > 150) return NextResponse.json({ error: "Give it a title (2 to 150 characters)" }, { status: 400 });
  if (description && description.length > 1000) return NextResponse.json({ error: "The description is too long" }, { status: 400 });

  const link = String(form.get("link") ?? "").trim();
  const file = form.get("file");

  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 4 MB. Share a Drive link instead." }, { status: 400 });
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const mimeType = ALLOWED[ext];
    if (!mimeType) {
      return NextResponse.json(
        { error: "That type of file can't be uploaded. Use PDF, Word, PowerPoint, Excel, text, an image or audio." },
        { status: 400 }
      );
    }
    const data = Buffer.from(await file.arrayBuffer());
    const resource = await prisma.resource.create({
      data: {
        title,
        description,
        classId: id,
        uploadedById: auth.user.id,
        kind: "FILE",
        fileUrl: "",
        fileName: cleanFileName(file.name),
        mimeType,
        size: file.size,
        file: { create: { data } },
      },
    });
    await prisma.resource.update({ where: { id: resource.id }, data: { fileUrl: `/api/materials/${resource.id}/file` } });
    await audit(auth.user, "MATERIAL_ADDED", `${auth.user.name} uploaded "${title}" (${resource.fileName})`, resource.id);
    return NextResponse.json({ id: resource.id }, { status: 201 });
  }

  if (link) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      return NextResponse.json({ error: "That link isn't a valid web address" }, { status: 400 });
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return NextResponse.json({ error: "Links must start with https://" }, { status: 400 });
    }
    const resource = await prisma.resource.create({
      data: { title, description, classId: id, uploadedById: auth.user.id, kind: "LINK", fileUrl: url.toString().slice(0, 2000) },
    });
    await audit(auth.user, "MATERIAL_ADDED", `${auth.user.name} shared the link "${title}"`, resource.id);
    return NextResponse.json({ id: resource.id }, { status: 201 });
  }

  return NextResponse.json({ error: "Choose a file or paste a link" }, { status: 400 });
}
