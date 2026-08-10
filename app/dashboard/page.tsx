import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    select: { name: true, email: true, role: true },
  });
  if (!user) redirect("/login");

  const menuByRole: Record<string, { label: string; href: string }[]> = {
    STAKE_ADMIN: [
      { label: "Manage Coordinators", href: "/dashboard/coordinators" },
      
      { label: "View All Classes", href: "/dashboard/classes" },
      { label: "Manage Students & Teachers", href: "/dashboard/students" },
      { label: "Semesters", href: "/dashboard/semesters" },
    ],
    COORDINATOR: [
      { label: "Create Classes", href: "/dashboard/classes" },
      { label: "Register Students", href: "/dashboard/students" },
      { label: "Enrollments", href: "/dashboard/enrollments" },
    ],
    TEACHER: [
      { label: "My Classes", href: "/dashboard/my-classes" },
      { label: "Mark Attendance", href: "/dashboard/my-classes" },
    ],
    STUDENT: [
  { label: "My Schedule", href: "/dashboard/my-schedule" },
  { label: "Check In to Class", href: "/dashboard/my-schedule" },
],
  };
  const menuItems = menuByRole[user.role] ?? [];

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b-2 border-gold bg-navy px-8 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="font-display text-2xl tracking-wide text-parchment">IRMS</h1>
          <div className="text-right">
            <p className="text-sm font-medium text-parchment">{user.name}</p>
            <p className="text-xs uppercase tracking-wider text-gold">{user.role}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">
        <div className="mb-10 rounded border-l-4 border-gold bg-white p-6 shadow-sm">
          <p className="font-display text-xl text-navy">Welcome, {user.name}</p>
          <p className="mt-1 text-sm text-navy/70">{user.email}</p>
        </div>

        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-navy/50">Quick Actions</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="group block cursor-pointer rounded border border-navy/10 bg-white p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-gold hover:shadow-md"
            >
              <p className="font-medium text-navy transition-colors group-hover:text-gold">
                {item.label}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}