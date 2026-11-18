"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, BookOpen, CalendarHeart, Megaphone, Paperclip, X } from "lucide-react";

type Notice = {
  id: string;
  kind: "announcement" | "material" | "lesson" | "event";
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

const ICON = { announcement: Megaphone, material: Paperclip, lesson: BookOpen, event: CalendarHeart };
const TONE = { announcement: "bg-gold text-navy", material: "bg-sage text-white", lesson: "bg-navy text-gold", event: "bg-clay text-white" };

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/**
 * The bell: a list of what's new, and a pop-up in the corner whenever something new arrives.
 * One bell for every screen size: in the navy top bar on phones, floating top-right on computers.
 */
export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [popups, setPopups] = useState<Notice[]>([]);
  const known = useRef<Set<string> | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications").catch(() => null);
    if (!res?.ok) return;
    const data: { items: Notice[]; unread: number } = await res.json();
    setItems(data.items);
    setUnread(data.unread);

    if (known.current === null) {
      // First load: pop up what arrived since they last looked (at most two)
      known.current = new Set(data.items.map((n) => n.id));
      setPopups(data.items.slice(0, Math.min(data.unread, 2)));
    } else {
      const fresh = data.items.filter((n) => !known.current!.has(n.id));
      fresh.forEach((n) => known.current!.add(n.id));
      if (fresh.length) setPopups((p) => [...fresh.slice(0, 3), ...p].slice(0, 3));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // Pop-ups close by themselves
  useEffect(() => {
    if (!popups.length) return;
    const t = setTimeout(() => setPopups((p) => p.slice(0, -1)), 8000);
    return () => clearTimeout(t);
  }, [popups]);

  // Close the list when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seen" }),
      }).catch(() => {});
    }
  }

  function go(n: Notice) {
    setOpen(false);
    setPopups((p) => p.filter((x) => x.id !== n.id));
    router.push(n.href);
  }

  const Ring = unread > 0 ? BellRing : Bell;

  return (
    <>
      <div ref={panel} className="fixed right-3 top-2 z-[45] lg:right-6 lg:top-4">
        <button
          onClick={toggle}
          aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-parchment transition-transform hover:scale-105 lg:h-11 lg:w-11 lg:bg-white/90 lg:text-navy lg:shadow-lg lg:ring-1 lg:ring-navy/10 lg:backdrop-blur"
        >
          <Ring size={20} className={unread ? "animate-[irms-wiggle_1.2s_ease-in-out_infinite]" : ""} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white ring-2 ring-white">
              <span className="irms-ping absolute h-full w-full rounded-full bg-clay" />
              <span className="relative">{unread > 9 ? "9+" : unread}</span>
            </span>
          )}
        </button>

        {open && (
          <div className="irms-pop absolute right-0 top-12 z-[65] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-navy/10 bg-white text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-navy/5 px-4 py-3">
              <p className="font-display text-lg text-navy">Notifications</p>
              <button onClick={() => setOpen(false)} className="text-navy/40 hover:text-navy" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <Bell className="irms-bob text-navy/20" size={36} />
                <p className="mt-3 text-sm text-navy/50">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-navy/5 overflow-y-auto">
                {items.map((n) => {
                  const Icon = ICON[n.kind];
                  return (
                    <li key={n.id}>
                      <button onClick={() => go(n)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-parchment">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE[n.kind]}`}>
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-navy">{n.title}</span>
                          <span className="block truncate text-xs text-navy/55">{n.body}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-navy/40">{ago(n.createdAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Pop-ups in the corner when something new arrives */}
      {popups.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[66] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
          {popups.map((n) => {
            const Icon = ICON[n.kind];
            return (
              <div key={n.id} className="irms-toast flex items-start gap-3 rounded-2xl border-l-4 border-gold bg-white p-4 shadow-2xl ring-1 ring-navy/10">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[n.kind]}`}>
                  <Icon size={16} />
                </span>
                <button onClick={() => go(n)} className="min-w-0 flex-1 text-left">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gold">
                    {n.kind === "announcement" ? "New announcement" : n.kind === "material" ? "New material" : n.kind === "event" ? "New event" : "Lesson shared"}
                  </span>
                  <span className="block text-sm font-medium text-navy">{n.title.replace(/^(New material|Next lesson): /, "")}</span>
                  <span className="block truncate text-xs text-navy/55">{n.body}</span>
                </button>
                <button onClick={() => setPopups((p) => p.filter((x) => x.id !== n.id))} className="text-navy/30 hover:text-navy" aria-label="Dismiss">
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
