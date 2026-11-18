import { prisma } from "@/lib/prisma";

export type Notice = {
  id: string;
  kind: "announcement" | "material" | "lesson" | "event";
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

const WINDOW_DAYS = 30;
const LIMIT = 20;

/**
 * What's new for this person: announcements meant for them, plus (for students)
 * new materials and newly shared lessons in their classes. Their own posts are left out.
 */
export async function notificationsFor(userId: string): Promise<{ items: Notice[]; unread: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      stake: true,
      notificationsSeenAt: true,
      createdAt: true,
      student: { select: { id: true, stake: true, enrollments: { where: { status: { not: "DROPPED" } }, select: { classId: true } } } },
      teacher: { select: { classes: { select: { id: true } } } },
    },
  });
  if (!user) return { items: [], unread: 0 };

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const studentClasses = user.student?.enrollments.map((e) => e.classId) ?? [];
  const teacherClasses = user.teacher?.classes.map((c) => c.id) ?? [];

  // Which announcements this person may see
  let announcementWhere: object;
  if (user.role === "STUDENT") {
    const stakes: { targetStake: string | null }[] = [{ targetStake: null }];
    if (user.student?.stake) stakes.push({ targetStake: user.student.stake });
    announcementWhere = {
      AND: [{ OR: [{ classId: null }, { classId: { in: studentClasses } }] }, { OR: stakes }],
    };
  } else if (user.role === "TEACHER") {
    announcementWhere = { OR: [{ classId: null }, { classId: { in: teacherClasses } }] };
  } else if ((user.role === "STAKE_ADMIN" || user.role === "COORDINATOR") && user.stake) {
    announcementWhere = { OR: [{ targetStake: null }, { targetStake: user.stake }] };
  } else {
    announcementWhere = {};
  }

  const [announcements, materials, lessons, events] = await Promise.all([
    prisma.announcement.findMany({
      where: { ...announcementWhere, createdAt: { gte: since }, NOT: { authorId: user.id } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      include: { class: { select: { id: true, name: true } }, author: { select: { name: true } } },
    }),
    studentClasses.length
      ? prisma.resource.findMany({
          where: { classId: { in: studentClasses }, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: LIMIT,
          select: { id: true, title: true, createdAt: true, class: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    studentClasses.length
      ? prisma.lessonPlan.findMany({
          where: { classId: { in: studentClasses }, shared: true, status: "READY", updatedAt: { gte: since } },
          orderBy: { updatedAt: "desc" },
          take: LIMIT,
          select: { id: true, title: true, scriptures: true, updatedAt: true, class: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    // Newly planned events that haven't happened yet
    prisma.event.findMany({
      where: { createdAt: { gte: since }, date: { gte: new Date() }, NOT: { createdById: user.id } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, title: true, date: true, venue: true, createdAt: true },
    }),
  ]);

  const items: Notice[] = [
    ...announcements.map((a) => ({
      id: `a_${a.id}`,
      kind: "announcement" as const,
      title: a.title,
      body: a.class ? `${a.class.name} · ${a.author.name}` : a.author.name,
      href: a.class ? `/dashboard/class/${a.class.id}?tab=announcements` : "/dashboard",
      createdAt: a.createdAt.toISOString(),
    })),
    ...materials.map((m) => ({
      id: `m_${m.id}`,
      kind: "material" as const,
      title: `New material: ${m.title}`,
      body: m.class.name,
      href: `/dashboard/class/${m.class.id}?tab=materials`,
      createdAt: m.createdAt.toISOString(),
    })),
    ...lessons.map((l) => ({
      id: `l_${l.id}`,
      kind: "lesson" as const,
      title: `Next lesson: ${l.title}`,
      body: l.scriptures ? `${l.class.name} · Read ${l.scriptures}` : l.class.name,
      href: `/dashboard/class/${l.class.id}?tab=lessons`,
      createdAt: l.updatedAt.toISOString(),
    })),
    ...events.map((ev) => ({
      id: `e_${ev.id}`,
      kind: "event" as const,
      title: ev.title,
      body:
        ev.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }) +
        (ev.venue ? ` · ${ev.venue}` : ""),
      href: "/dashboard/events",
      createdAt: ev.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIMIT);

  // New accounts don't start with a month of "unread" items
  const seen = user.notificationsSeenAt ?? user.createdAt;
  const unread = items.filter((n) => new Date(n.createdAt) > seen).length;
  return { items, unread };
}
