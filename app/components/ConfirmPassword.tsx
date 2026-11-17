"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Lock, ShieldAlert } from "lucide-react";

/**
 * Asks for your password before a dangerous action.
 *   const { ask, dialog } = useConfirmPassword();
 *   const pw = await ask("Delete Ade?");   // null if cancelled
 *   ...render {dialog} somewhere in the page
 */
export function useConfirmPassword() {
  const [request, setRequest] = useState<{ message: string; danger: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const resolver = useRef<((v: string | null) => void) | null>(null);

  function ask(message: string, danger = true): Promise<string | null> {
    setPassword("");
    setRequest({ message, danger });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }

  function finish(value: string | null) {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
    setPassword("");
  }

  const dialog = request ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm" onClick={() => finish(null)}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (password) finish(password);
        }}
        className="irms-pop w-full max-w-sm rounded-2xl border-t-4 border-gold bg-white p-6 shadow-2xl"
      >
        <span
          className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full ${
            request.danger ? "bg-clay/10 text-clay" : "bg-navy/5 text-navy"
          }`}
        >
          {request.danger ? <ShieldAlert size={22} /> : <Lock size={22} />}
        </span>
        <p className="font-display text-lg text-navy">{request.message}</p>
        <p className="mb-4 mt-1 text-sm text-navy/60">Type your password to confirm it&apos;s you.</p>
        <input
          autoFocus
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold"
          placeholder="Your password"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => finish(null)} className="rounded px-4 py-2 text-sm text-navy/70 hover:text-navy">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!password}
            className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              request.danger ? "bg-clay hover:bg-clay/90" : "bg-navy hover:bg-gold hover:text-navy"
            }`}
          >
            Confirm
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return { ask, dialog };
}

/** Shown when super admin tools are locked because two-step sign-in is off. */
export function TwoFactorRequired() {
  return (
    <div className="rounded-2xl border-2 border-clay/40 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-2 font-display text-lg text-clay">
        <ShieldAlert size={22} /> Two-step sign-in needed
      </p>
      <p className="mt-2 text-sm text-navy/70">
        Super admin tools can change everything in IRMS, so they only open once your account has two-step sign-in
        switched on. It takes about a minute.
      </p>
      <Link
        href="/dashboard/change-password"
        className="mt-4 inline-block rounded bg-navy px-4 py-2 text-sm font-medium text-parchment hover:bg-gold hover:text-navy"
      >
        Switch it on in My Account
      </Link>
    </div>
  );
}
