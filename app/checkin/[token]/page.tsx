"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getLocation, type GeoFailure } from "@/lib/browserLocation";
import { IrmsMark, StakeLogo } from "@/app/components/Brand";

type Phase = "locating" | "checking" | "success" | "error";

function locationHelp(reason: GeoFailure | null) {
  switch (reason) {
    case "denied":
      return "Location is blocked for this page. Tap the lock icon next to the address bar, set Location to Allow, then reload. If you opened this link from your camera app, open it in Chrome instead.";
    case "unavailable":
      return "Your phone couldn't work out where it is. Turn Location on in your phone's settings, move near a window, then try again.";
    case "timeout":
      return "Finding your location took too long. Make sure Location is turned on, move near a window, then try again.";
    case "unsupported":
      return "This browser can't share its location. Open the link in Chrome.";
    default:
      return "Your location is needed to confirm you're in class. Turn Location on, allow it for this page, then try again.";
  }
}

export default function CheckInPage() {
  const params = useParams();
  const token = params.token as string;
  const [phase, setPhase] = useState<Phase>("locating");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<{ className?: string; again: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const loginUrl = `/login?next=${encodeURIComponent(window.location.pathname)}`;

      // Sign in first, so the code doesn't expire while you're logging in
      const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => null);
      if (cancelled) return;
      if (!me) {
        window.location.href = loginUrl;
        return;
      }

      const geo = await getLocation();
      if (cancelled) return;
      setPhase("checking");

      const res = await fetch(`/api/attendance/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geo.ok ? geo.fix : {}),
      });

      if (res.status === 401) {
        window.location.href = loginUrl;
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (cancelled) return;

      if (res.ok) {
        setDone({ className: data.className, again: !!data.alreadyCheckedIn });
        setPhase("success");
        return;
      }

      setPhase("error");
      if (data.code === "LOCATION_REQUIRED") {
        setMessage(locationHelp(geo.ok ? null : geo.reason));
      } else if (data.code === "TOO_FAR") {
        setMessage(
          `${data.error} If you are in class, tell your teacher: they can switch location checking off for this session.`
        );
      } else {
        setMessage(data.error ?? "Check-in failed. Please try again.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4 py-10">
      <div className="mb-6 flex flex-col items-center">
        <StakeLogo size={80} />
        <div className="mt-3 flex items-center gap-2">
          <IrmsMark size={24} />
          <span className="font-display text-xl tracking-wide text-parchment">IRMS</span>
        </div>
      </div>

      <div className="w-full max-w-sm rounded border-t-4 border-gold bg-parchment p-6 text-center shadow-xl">
        {phase === "locating" && <p className="text-navy/70">Finding your location...</p>}
        {phase === "checking" && <p className="text-navy/70">Checking you in...</p>}
        {phase === "success" && (
          <>
            <p className="text-lg font-medium text-sage">
              {done?.again ? "You're already checked in." : "You're checked in!"}
            </p>
            {done?.className && <p className="mt-2 text-sm text-navy/70">{done.className}</p>}
            <p className="mt-4 text-xs text-navy/50">You can close this page.</p>
          </>
        )}
        {phase === "error" && (
          <>
            <p className="mb-4 text-sm font-medium text-clay">{message}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}