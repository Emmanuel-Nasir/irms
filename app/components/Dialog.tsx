"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";

/**
 * The app's own pop-up, used instead of the browser's grey confirm/alert boxes.
 *
 *   if (!(await askConfirm("Delete this?", { danger: true }))) return;
 *   await showNotice("Saved", { title: "Done" });
 *
 * <DialogHost /> is mounted once, in the root layout.
 */
type Request = {
  id: number;
  kind: "confirm" | "notice";
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};
type Options = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };

let push: ((r: Request) => void) | null = null;
let nextId = 1;

function open(kind: Request["kind"], message: string, opts: Options): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) {
      // The host isn't mounted (shouldn't happen) — fall back to the browser's box
      resolve(kind === "confirm" ? window.confirm(message) : (window.alert(message), true));
      return;
    }
    push({ id: nextId++, kind, message, ...opts, resolve });
  });
}

export function askConfirm(message: string, opts: Options = {}) {
  return open("confirm", message, opts);
}
export function showNotice(message: string, opts: Options = {}) {
  return open("notice", message, opts).then(() => undefined);
}

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const okRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => {
    push = (r) => setQueue((q) => [...q, r]);
    return () => {
      push = null;
    };
  }, []);

  function close(ok: boolean) {
    if (!current) return;
    current.resolve(ok);
    setQueue((q) => q.slice(1));
  }

  useEffect(() => {
    if (!current) return;
    okRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  const Icon = current.kind === "notice" ? Info : current.danger ? AlertTriangle : HelpCircle;
  const title = current.title ?? (current.kind === "notice" ? "Heads up" : current.danger ? "Are you sure?" : "Please confirm");

  return (
    <div
      className="irms-page-enter fixed inset-0 z-[70] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
      onClick={() => close(false)}
      role="presentation"
    >
      <div
        key={current.id}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="irms-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={`irms-pop w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-navy/10`}
      >
        <div className={`h-1.5 ${current.danger ? "bg-gradient-to-r from-clay via-clay/70 to-gold" : "bg-gradient-to-r from-navy via-gold to-navy"}`} />
        <div className="p-6">
          <span
            className={`irms-pulse-ring mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full ${
              current.danger ? "bg-clay/10 text-clay" : "bg-gold/15 text-navy"
            }`}
          >
            <Icon size={24} />
          </span>
          <h2 id="irms-dialog-title" className="font-display text-xl text-navy">{title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy/70">{current.message}</p>
          <div className="mt-6 flex justify-end gap-2">
            {current.kind === "confirm" && (
              <button
                onClick={() => close(false)}
                className="rounded-full px-5 py-2 text-sm font-medium text-navy/65 transition-colors hover:bg-navy/5 hover:text-navy"
              >
                {current.cancelLabel ?? "Cancel"}
              </button>
            )}
            <button
              ref={okRef}
              onClick={() => close(true)}
              className={`irms-shine rounded-full px-5 py-2 text-sm font-semibold shadow transition-all hover:scale-105 active:scale-95 ${
                current.danger ? "bg-clay text-white hover:bg-clay/90" : "bg-navy text-parchment hover:bg-gold hover:text-navy"
              }`}
            >
              {current.confirmLabel ?? (current.kind === "notice" ? "OK" : "Yes, continue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
