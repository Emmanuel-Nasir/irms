"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen, Calendar, CalendarDays, ClipboardList, Download, FileText, GraduationCap,
  KeyRound, LayoutDashboard, Library, LogOut, Megaphone, Menu, School, Shield,
  ShieldCheck, UserCog, Users, X, type LucideIcon,
} from "lucide-react";import { IrmsMark, StakeLogo } from "@/app/components/Brand";


type NavItem = { href: string; label: string; roles: string[]; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"] },
  { href: "/dashboard/my-classes", label: "My Classes", icon: BookOpen, roles: ["TEACHER"] },
  { href: "/dashboard/my-schedule", label: "My Schedule", icon: CalendarDays, roles: ["STUDENT"] },
  { href: "/dashboard/users", label: "All Users", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
  { href: "/dashboard/admins", label: "Stake Admins", icon: Shield, roles: ["AREA_ADMIN"] },
  { href: "/dashboard/coordinators", label: "Coordinators", icon: UserCog, roles: ["AREA_ADMIN", "STAKE_ADMIN"] },
  { href: "/dashboard/semesters", label: "Semesters", icon: Calendar, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/classes", label: "Classes", icon: Library, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/students", label: "Students", icon: Users, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/teachers", label: "Teachers", icon: School, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/enrollments", label: "Enrollments", icon: ClipboardList, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/graduation", label: "Graduation", icon: GraduationCap, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/export", label: "Export Data", icon: Download, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"] },
  { href: "/dashboard/change-password", label: "Change Password", icon: KeyRound, roles: ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR", "TEACHER", "STUDENT"] },
];

type CurrentUser = { name: string; role: string } | null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(setUser);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const visibleNav = user
    ? NAV.filter(
        (item) =>
          item.roles.includes(user.role) ||
          (user.role === "SUPER_ADMIN" && item.roles.includes("AREA_ADMIN"))
      )
    : [];

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-parchment lg:flex">
      {/* Phone top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-parchment">
          <Menu size={24} />
        </button>
        <span className="flex items-center gap-2">
          <StakeLogo size={28} />
          <span className="font-display text-lg tracking-wide text-parchment">IRMS</span>
        </span>
        <span className="w-6" />
      </div>

      {/* Dark overlay behind the menu on phones */}
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy px-5 py-6 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <StakeLogo size={44} />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <IrmsMark size={18} />
                <p className="font-display text-lg tracking-wide text-parchment">IRMS</p>
              </div>
              <p className="text-[11px] text-parchment/60">Oke-Ata Stake</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-parchment lg:hidden">
            <X size={22} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors hover:bg-navy-light hover:text-gold ${
                isActive(item.href) ? "bg-navy-light text-gold" : "text-parchment/80"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-parchment/10 pt-4">
          {user && (
            <>
              <p className="text-sm text-parchment">{user.name}</p>
              <p className="mb-3 text-xs uppercase tracking-wider text-gold">{user.role}</p>
            </>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded border border-parchment/20 py-1.5 text-sm text-parchment/80 transition-colors hover:border-clay hover:text-clay"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}