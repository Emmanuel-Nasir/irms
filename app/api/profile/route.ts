import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import * as v from "@/lib/validate";

// Your own details. Students can also set their ward; the stake is set by leaders.
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: current.userId },
    select: {
      name: true,
      email: true,
      role: true,
      stake: true,
      createdAt: true,
      student: { select: { phone: true, ward: true, stake: true, occupation: true, school: true } },
      teacher: { select: { phone: true } },
    },
  });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: current.userId }, include: { student: true, teacher: true } });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = v.name(body.name ?? user.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const phone = v.phone(body.phone);
  if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });
  const ward = v.optionalText(body.ward, "Ward");
  if (!ward.ok) return NextResponse.json({ error: ward.error }, { status: 400 });
  const occupation = v.optionalText(body.occupation, "Occupation");
  if (!occupation.ok) return NextResponse.json({ error: occupation.error }, { status: 400 });
  const school = v.optionalText(body.school, "School");
  if (!school.ok) return NextResponse.json({ error: school.error }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { name: name.value } });
    if (user.student) {
      await tx.student.update({
        where: { id: user.student.id },
        data: { phone: phone.value, ward: ward.value, occupation: occupation.value, school: school.value },
      });
    }
    if (user.teacher) await tx.teacher.update({ where: { id: user.teacher.id }, data: { phone: phone.value } });
  });
  await audit({ id: user.id, name: name.value }, "PROFILE_UPDATED", `${name.value} updated their profile`, user.id);
  return NextResponse.json({ success: true });
}
