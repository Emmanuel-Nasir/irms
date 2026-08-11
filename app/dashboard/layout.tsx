"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string; roles: string[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"] },
  { href: "/dashboard/my-classes", label: "My Classes", roles: ["TEACHER"] },
  { href: "/dashboard/my-schedule", label: "My Schedule", roles: ["STUDENT"] },
  { href: "/dashboard/admins", label: "Stake Admins", roles: ["AREA_ADMIN"] },
  { href: "/dashboard/coordinators", label: "Coordinators", roles: ["AREA_ADMIN", "STAKE_ADMIN"] },
  { href: "/dashboard/semesters", label: "Semesters", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/classes", label: "Classes", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/students", label: "Students", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/teachers", label: "Teachers", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/enrollments", label: "Enrollments", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/graduation", label: "Graduation", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/reports", label: "Reports", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/change-password", label: "Change Password", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"] },
{ href: "/dashboard/export", label: "Export Data", roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
];

type CurrentUser = { name: string; role: string } | null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(setUser);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const visibleNav = user ? NAV.filter((item) => item.roles.includes(user.role)) : [];

  return (
    <div className="flex min-h-screen bg-parchment">
      <aside className="flex w-56 flex-col justify-between bg-navy px-5 py-6">
        <div>
          <p className="mb-8 font-display text-xl tracking-wide text-parchment">IRMS</p>
          <nav className="space-y-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded px-3 py-2 text-sm text-parchment/80 transition-colors hover:bg-navy-light hover:text-gold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="border-t border-parchment/10 pt-4">
          {user && (
            <>
              <p className="text-sm text-parchment">{user.name}</p>
              <p className="mb-3 text-xs uppercase tracking-wider text-gold">{user.role}</p>
            </>
          )}
          <button
            onClick={handleLogout}
            className="w-full rounded border border-parchment/20 py-1.5 text-sm text-parchment/80 transition-colors hover:border-clay hover:text-clay"
          >
            Log Out
          </button>
        </div>
      </aside>

      <div className="flex-1">{children}</div>
    </div>
  );
}