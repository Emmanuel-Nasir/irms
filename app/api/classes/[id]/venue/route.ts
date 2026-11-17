import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, canManageClass, CLASS_MANAGERS } from "@/lib/permissions";
import { MAX_VENUE_ACCURACY_METERS } from "@/lib/geo";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const SELECT = {
  id: true,
  name: true,
  venue: true,
  venueLatitude: true,
  venueLongitude: true,
  venueAccuracy: true,
  venueSavedAt: true,
} as const;

async function guard(id: string) {
  const auth = await requireRole(CLASS_MANAGERS);
  if (!auth.ok) return { response: auth.response, user: null };
  if (!(await canManageClass(auth.user, id))) {
    return { response: NextResponse.json({ error: "This isn't your class" }, { status: 403 }), user: null };
  }
  return { response: null, user: auth.user };
}

// The class's name and its saved classroom location (if any)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { response } = await guard(id);
  if (response) return response;

  const cls = await prisma.class.findUnique({ where: { id }, select: SELECT });
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  return NextResponse.json(cls);
}

// Save where this class meets. Only a precise position is accepted, because every
// student's check-in will be measured against it.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { response, user } = await guard(id);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const { latitude, longitude, accuracy } = body as Record<string, unknown>;
  const valid =
    typeof latitude === "number" && Math.abs(latitude) <= 90 &&
    typeof longitude === "number" && Math.abs(longitude) <= 180 &&
    typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0;
  if (!valid) {
    return NextResponse.json({ error: "That location couldn't be read. Please try again." }, { status: 400 });
  }
  if (accuracy > MAX_VENUE_ACCURACY_METERS) {
    return NextResponse.json(
      {
        error: `This device only knows its position to about ${Math.round(accuracy)} m. Save the classroom location from a phone inside the room, with Location turned on (it needs to be within ${MAX_VENUE_ACCURACY_METERS} m).`,
      },
      { status: 400 }
    );
  }

  const cls = await prisma.class.update({
    where: { id },
    data: { venueLatitude: latitude, venueLongitude: longitude, venueAccuracy: accuracy, venueSavedAt: new Date() },
    select: SELECT,
  });
  await audit(user, "CLASSROOM_LOCATION", `${user?.name} saved the classroom location for ${cls.name} (to about ${Math.round(accuracy)} m)`, id);
  return NextResponse.json(cls);
}

// Forget the saved location (for example if the class moves to another building)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { response, user } = await guard(id);
  if (response) return response;

  const cls = await prisma.class.update({
    where: { id },
    data: { venueLatitude: null, venueLongitude: null, venueAccuracy: null, venueSavedAt: null },
    select: SELECT,
  });
  await audit(user, "CLASSROOM_LOCATION", `${user?.name} forgot the classroom location for ${cls.name}`, id);
  return NextResponse.json(cls);
}
