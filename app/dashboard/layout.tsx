"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, BookOpen, Calendar, CalendarDays, ChevronsLeft, ChevronsRight, ClipboardList, Download, FileText,
  GraduationCap, KeyRound, LayoutDashboard, Library, LockKeyhole, LogOut, Megaphone, Menu, School, Search,
  Shield, ShieldCheck, Timer, UserCog, Users, X, type LucideIcon,
} from "lucide-react";
import { IrmsMark, StakeLogo } from "@/app/components/Brand";
import { AnimatedBackground } from "@/app/components/Motion";

type NavItem = { href: string; label: string; roles: string[]; icon: LucideIcon; keywords?: string };
type NavGroup = { title: string; items: NavItem[] };

const LEADERS = ["AREA_ADMIN", "STAKE_ADMIN", "COORDINATOR"];
const EVERYONE = [...LEADERS, "TEACHER", "STUDENT"];

// Grouped menu. Super admins see everything area admins see, plus the Admin group.
const GROUPS: NavGroup[] = [
  {
    title: "Home",
    items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: EVERYONE, keywords: "home dashboard" }],
  },
  {
    title: "My work",
    items: [
      { href: "/dashboard/my-classes", label: "My Classes", icon: BookOpen, roles: ["TEACHER"], keywords: "lessons plans materials teach" },
      { href: "/dashboard/my-schedule", label: "My Schedule", icon: CalendarDays, roles: ["STUDENT"], keywords: "scan qr check in classes" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/dashboard/students", label: "Students", icon: Users, roles: LEADERS, keywords: "register members" },
      { href: "/dashboard/teachers", label: "Teachers", icon: School, roles: LEADERS, keywords: "instructors" },
      { href: "/dashboard/coordinators", label: "Coordinators", icon: UserCog, roles: ["AREA_ADMIN", "STAKE_ADMIN"] },
      { href: "/dashboard/admins", label: "Stake Admins", icon: Shield, roles: ["AREA_ADMIN"] },
    ],
  },
  {
    title: "Classes",
    items: [
      { href: "/dashboard/semesters", label: "Semesters", icon: Calendar, roles: LEADERS, keywords: "terms" },
      { href: "/dashboard/classes", label: "Classes", icon: Library, roles: LEADERS, keywords: "courses" },
      { href: "/dashboard/enrollments", label: "Enrollments", icon: ClipboardList, roles: LEADERS, keywords: "enroll register class" },
      { href: "/dashboard/graduation", label: "Graduation", icon: GraduationCap, roles: LEADERS, keywords: "credits progress" },
    ],
  },
  {
    title: "Communicate & report",
    items: [
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: LEADERS, keywords: "news post message" },
      { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: LEADERS, keywords: "stakes statistics" },
      { href: "/dashboard/export", label: "Export Data", icon: Download, roles: LEADERS, keywords: "csv download spreadsheet attendance sheet" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/dashboard/users", label: "All Users", icon: ShieldCheck, roles: ["SUPER_ADMIN"], keywords: "accounts roles reset password delete" },
      { href: "/dashboard/security", label: "Security Centre", icon: LockKeyhole, roles: ["SUPER_ADMIN"], keywords: "locked backup sign out" },
      { href: "/dashboard/activity", label: "Activity Log", icon: Activity, roles: ["SUPER_ADMIN"], keywords: "audit history log" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/dashboard/change-password", label: "My Account", icon: KeyRound, roles: EVERYONE, keywords: "password email two-step 2fa" }],
  },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  AREA_ADMIN: "Area Admin",
  STAKE_ADMIN: "Stake Admin",
  COORDINATOR: "Coordinator",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

// Sign out after this long with no activity (minutes). Leaders hold more personal data, so shorter.
const IDLE_MINUTES: Record<string, number> = {
  SUPER_ADMIN: 20,
  AREA_ADMIN: 30,
  STAKE_ADMIN: 30,
  COORDINATOR: 30,
  TEACHER: 60,
  STUDENT: 120,
};
const WARN_SECONDS = 60;

type Me = { name: string; email: string; role: string; mustChangePassword?: boolean; totpEnabledAt?: string | null } | null;
type Badge = { count: number; tone: "gold" | "clay" | "sage"; hint: string };

const BADGE_TONE = { gold: "bg-gold text-navy", clay: "bg-clay text-white", sage: "bg-sage text-white" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Me>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [badges, setBadges] = useState<Record<string, Badge>>({});
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastActive = useRef(Date.now());

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("irms:sidebar") === "collapsed");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("irms:sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((me: Me) => {
        if (!me) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        else setUser(me);
      })
      .catch(() => {});
  }, [router]);

  // Accounts made or reset by an admin must choose their own password before anything else
  useEffect(() => {
    if (user?.mustChangePassword && !pathname.startsWith("/dashboard/change-password")) {
      router.replace("/dashboard/change-password?first=1");
    }
  }, [user, pathname, router]);

  const loadBadges = useCallback(() => {
    fetch("/api/nav/badges")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setBadges)
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadBadges();
    const t = setInterval(loadBadges, 60000);
    return () => clearInterval(t);
  }, [loadBadges, pathname]);

  const logout = useCallback(
    async (reason?: string) => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      router.push(reason ? `/login?reason=${reason}` : "/login");
    },
    [router]
  );

  // Automatic sign-out when idle. Not on the attendance screen, which may sit on a projector.
  useEffect(() => {
    if (!user) return;
    const limit = (IDLE_MINUTES[user.role] ?? 30) * 60;
    const bump = () => {
      lastActive.current = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (pathname.startsWith("/dashboard/attendance")) {
        lastActive.current = Date.now();
        setIdleLeft(null);
        return;
      }
      const idle = (Date.now() - lastActive.current) / 1000;
      const left = Math.ceil(limit - idle);
      if (left <= 0) {
        clearInterval(timer);
        logout("idle");
      } else if (left <= WARN_SECONDS) {
        setIdleLeft(left);
      } else {
        setIdleLeft(null);
      }
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [user, pathname, logout]);

  // Ctrl+K (or ⌘K) jumps to the menu search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCollapsed(false);
        setOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    if (!user) return [];
    const q = query.trim().toLowerCase();
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          (item.roles.includes(user.role) ||
            (user.role === "SUPER_ADMIN" && (item.roles.includes("AREA_ADMIN") || item.roles.includes("SUPER_ADMIN")))) &&
          (!q || `${item.label} ${item.keywords ?? ""} ${g.title}`.toLowerCase().includes(q))
      ),
    })).filter((g) => g.items.length > 0);
  }, [user, query]);

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  function goFirstMatch(e: React.FormEvent) {
    e.preventDefault();
    const first = groups[0]?.items[0];
    if (first) {
      router.push(first.href);
      setQuery("");
      setOpen(false);
    }
  }

  // On phones the drawer always shows full labels
  const slim = collapsed && !open;
  let delay = 0;

  return (
    <div className="min-h-screen bg-parchment lg:flex">
      {/* Phone top bar */}
      <div className="irms-gradient-pan sticky top-0 z-30 flex items-center justify-between overflow-hidden bg-gradient-to-r from-navy via-navy-light to-navy px-4 py-3 shadow-lg lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="irms-wiggle text-parchment">
          <Menu size={24} />
        </button>
        <span className="flex items-center gap-2">
          <StakeLogo size={28} />
          <span className="font-display text-lg tracking-wide text-parchment">IRMS</span>
        </span>
        <span className="relative w-6">
          {Object.keys(badges).length > 0 && <span className="irms-ping absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-gold" />}
        </span>
        <div className="irms-shimmer-bar absolute inset-x-0 bottom-0 h-0.5" />
      </div>

      {open && (
        <div className="irms-page-enter fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-navy py-5 shadow-2xl transition-all duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${slim ? "w-[76px] px-3" : "w-72 px-4 lg:w-64"}`}
      >
        <AnimatedBackground tone="dark" fixed={false} shapes={false} />

        {/* Brand */}
        <div className={`relative z-10 mb-4 flex items-center ${slim ? "justify-center" : "justify-between"}`}>
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <div className="irms-float relative shrink-0">
              <span className="irms-pulse-ring absolute inset-0 rounded-full border border-gold/60" />
              <StakeLogo size={slim ? 40 : 42} />
            </div>
            {!slim && (
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <IrmsMark size={18} />
                  <p className="font-display text-lg tracking-wide text-parchment">IRMS</p>
                </div>
                <p className="text-[11px] text-parchment/60">Oke-Ata Stake</p>
              </div>
            )}
          </Link>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-parchment lg:hidden">
            <X size={22} />
          </button>
        </div>

        {/* Search */}
        {!slim ? (
          <form onSubmit={goFirstMatch} className="relative z-10 mb-3">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment/40" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a page..."
              className="w-full rounded-lg border border-white/10 bg-white/10 py-2 pl-9 pr-12 text-sm text-parchment outline-none placeholder:text-parchment/40 focus:border-gold/60 focus:bg-white/15"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 text-[10px] text-parchment/40 lg:block">
              Ctrl K
            </kbd>
          </form>
        ) : (
          <button
            onClick={() => {
              toggleCollapsed();
              setTimeout(() => searchRef.current?.focus(), 350);
            }}
            title="Find a page (Ctrl K)"
            className="relative z-10 mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-parchment/70 hover:text-gold"
          >
            <Search size={18} />
          </button>
        )}

        {/* Menu */}
        <nav className="irms-nav-scroll relative z-10 -mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-2">
          {groups.length === 0 && query && <p className="px-3 py-4 text-sm text-parchment/50">No page matches “{query}”.</p>}
          {groups.map((g) => (
            <div key={g.title} className="mb-3">
              {slim ? (
                <div className="mx-auto mb-1.5 h-px w-8 bg-white/10" />
              ) : (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-parchment/35">{g.title}</p>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = isActive(item.href);
                  const badge = badges[item.href];
                  delay += 0.03;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      title={slim ? `${item.label}${badge ? ` (${badge.count} ${badge.hint.toLowerCase()})` : ""}` : undefined}
                      style={{ animationDelay: `${delay}s` }}
                      className={`irms-enter-left group relative flex items-center rounded-lg text-sm transition-all duration-200 hover:bg-white/10 hover:text-gold ${
                        slim ? "h-10 justify-center" : "gap-3 px-3 py-2 hover:translate-x-1"
                      } ${active ? "bg-white/10 font-medium text-gold shadow-inner" : "text-parchment/80"}`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-gold transition-all duration-300 ${
                          active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                        }`}
                      />
                      <item.icon
                        size={slim ? 20 : 18}
                        className={`shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${
                          active ? "drop-shadow-[0_0_6px_rgba(201,162,39,0.8)]" : ""
                        }`}
                      />
                      {!slim && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {badge &&
                        (slim ? (
                          <span className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ${BADGE_TONE[badge.tone].split(" ")[0]}`} />
                        ) : (
                          <span title={badge.hint} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${BADGE_TONE[badge.tone]}`}>
                            {badge.count}
                          </span>
                        ))}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse button (computers only) */}
        <button
          onClick={toggleCollapsed}
          className={`relative z-10 mb-3 hidden items-center gap-2 rounded-lg py-1.5 text-xs text-parchment/50 transition-colors hover:bg-white/10 hover:text-parchment lg:flex ${
            slim ? "justify-center" : "px-3"
          }`}
          title={slim ? "Expand menu" : "Collapse menu"}
        >
          {slim ? <ChevronsRight size={18} /> : <><ChevronsLeft size={16} /> Collapse menu</>}
        </button>

        {/* You */}
        <div className="relative z-10 border-t border-white/10 pt-3">
          {user && (
            <Link
              href="/dashboard/change-password"
              onClick={() => setOpen(false)}
              title={slim ? `${user.name} · ${ROLE_LABEL[user.role] ?? user.role}` : undefined}
              className={`mb-2 flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-white/10 ${slim ? "justify-center" : ""}`}
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold font-display text-navy">
                {user.name.charAt(0)}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-navy bg-sage" />
              </span>
              {!slim && (
                <div className="min-w-0">
                  <p className="truncate text-sm text-parchment">{user.name}</p>
                  <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-gold">
                    {ROLE_LABEL[user.role] ?? user.role}
                    {user.totpEnabledAt && <ShieldCheck size={11} className="text-sage" />}
                  </p>
                </div>
              )}
            </Link>
          )}
          <button
            onClick={() => logout()}
            title="Log out"
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-parchment/15 py-1.5 text-sm text-parchment/80 transition-all hover:border-clay hover:bg-clay/10 hover:text-clay`}
          >
            <LogOut size={16} />
            {!slim && "Log out"}
          </button>
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <AnimatedBackground tone="light" />
        {/* Re-keyed on every page change, so each page slides in */}
        <div key={pathname} className="irms-page irms-page-enter relative z-10">
          {children}
        </div>
      </div>

      {/* Idle warning */}
      {idleLeft !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div className="irms-pop w-full max-w-sm rounded-2xl border-t-4 border-gold bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Timer size={24} />
            </span>
            <p className="font-display text-xl text-navy">Still there?</p>
            <p className="mt-1 text-sm text-navy/65">
              For your safety you&apos;ll be signed out in <b className="text-clay tabular-nums">{idleLeft}</b> seconds.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => logout()} className="rounded-lg px-4 py-2 text-sm text-navy/70 hover:text-navy">
                Sign out now
              </button>
              <button
                onClick={() => {
                  lastActive.current = Date.now();
                  setIdleLeft(null);
                }}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-parchment hover:bg-gold hover:text-navy"
              >
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
