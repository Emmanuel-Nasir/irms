"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { TwoFactorRequired } from "@/app/components/ConfirmPassword";
import { CountUp } from "@/app/components/Motion";

type Entry = { id: string; actorName: string; action: string; summary: string; ip: string | null; createdAt: string };
type Data = { entries: Entry[]; total: number; page: number; pages: number; actions: { action: string; count: number }[] };

const ACTION_COLOR: Record<string, string> = {
  SIGN_IN: "bg-sage/15 text-sage",
  ACCOUNT_LOCKED: "bg-clay/15 text-clay",
  USER_DELETED: "bg-clay/15 text-clay",
  SIGNED_OUT_EVERYONE: "bg-clay/15 text-clay",
  BACKUP_DOWNLOADED: "bg-gold/25 text-navy",
  TWO_FACTOR_OFF: "bg-clay/15 text-clay",
  TWO_FACTOR_ON: "bg-sage/15 text-sage",
};

function pretty(action: string) {
  return action.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function ActivityPage() {
  const [data, setData] = useState<Data | null>(null);
  const [locked2fa, setLocked2fa] = useState(false);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (action) params.set("action", action);
    fetch(`/api/audit?${params.toString()}`).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (res.ok) setData(body);
      else if (body.code === "TWO_FACTOR_REQUIRED") setLocked2fa(true);
    });
  }, [query, action, page]);

  if (locked2fa) {
    return (
      <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
        <h1 className="mb-6 font-display text-2xl text-navy">Activity Log</h1>
        <div className="max-w-xl">
          <TwoFactorRequired />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="flex items-center gap-2 font-display text-2xl text-navy">
          <Activity className="text-gold" /> Activity Log
        </h1>
        <p className="mb-6 text-sm text-navy/60">
          Who did what, and when: sign-ins, account changes, attendance edits, backups. Entries can&apos;t be edited or
          deleted from the app. {data && <><CountUp value={data.total} /> entries.</>}
        </p>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/35" />
            <input
              placeholder="Search names, details or network address"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-navy/20 bg-white py-2 pl-10 pr-3 outline-none focus:border-gold"
            />
          </div>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-navy/20 bg-white px-3 py-2 outline-none focus:border-gold"
          >
            <option value="">All activity</option>
            {data?.actions.map((a) => (
              <option key={a.action} value={a.action}>
                {pretty(a.action)} ({a.count})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
          {!data ? (
            <p className="py-10 text-center text-sm text-navy/50">Loading...</p>
          ) : data.entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-navy/50">Nothing matches.</p>
          ) : (
            <ul className="divide-y divide-navy/5">
              {data.entries.map((e) => (
                <li key={e.id} className="irms-enter-left flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-parchment/60 sm:flex-row sm:items-center sm:gap-4">
                  <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_COLOR[e.action] ?? "bg-navy/5 text-navy/70"}`}>
                    {pretty(e.action)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-navy">{e.summary}</span>
                  <span className="shrink-0 text-xs text-navy/45">
                    {new Date(e.createdAt).toLocaleString()}
                    {e.ip && ` · ${e.ip}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && data.pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="flex items-center gap-1 rounded-lg border border-navy/20 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Newer
            </button>
            <span className="text-navy/60">
              Page {data.page} of {data.pages}
            </span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 rounded-lg border border-navy/20 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              Older <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
