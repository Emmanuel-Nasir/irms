"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getBestLocation, type GeoFailure } from "@/lib/browserLocation";
import { IrmsMark, StakeLogo } from "@/app/components/Brand";

type Phase = "locating" | "checking" | "success" | "error";
type Problem = { text: string; canRetry: boolean; rescan: boolean };

function locationHelp(reason: GeoFailure | null) {
  switch (reason) {
    case "denied":
      return "Location is blocked for this page. Tap the lock icon next to the address bar, set Location to Allow, then try again. If you opened this link from your camera app, open IRMS in Chrome and use Scan QR Code instead.";
    case "unavailable":
      return "Your phone couldn't work out where it is. Turn Location on in your phone's settings, move near a window, then try again.";
    case "timeout":
      return "Finding your location took too long. Make sure Location is turned on, move near a window, then try again.";
    case "unsupported":
      return "This browser can't share its location. Open IRMS in Chrome.";
    default:
      return "Your location is needed to confirm you're in class. Turn Location on, allow it for this page, then try again.";
  }
}

export default function CheckInPage() {
  const params = useParams();
  const token = params.token as string;
  const [phase, setPhase] = useState<Phase>("locating");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState<{ className?: string; again: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setPhase("locating");
      setAccuracy(null);
      setProblem(null);
      const loginUrl = `/login?next=${encodeURIComponent(window.location.pathname)}`;

      // Sign in first, so the code doesn't run out while you're logging in
      const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => null);
      if (cancelled) return;
      if (!me) {
        window.location.href = loginUrl;
        return;
      }

      // Wait a few seconds for GPS instead of taking the phone's first rough guess
      const geo = await getBestLocation({
        goodEnough: 25,
        maxWaitMs: 15000,
        onProgress: (fix) => !cancelled && setAccuracy(Math.round(fix.accuracy)),
      });
      if (cancelled) return;
      setPhase("checking");

      const res = await fetch(`/api/attendance/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geo.ok ? geo.fix : {}),
      }).catch(() => null);
      if (cancelled) return;

      if (!res) {
        setPhase("error");
        setProblem({ text: "Couldn't reach IRMS. Check your internet connection, then try again.", canRetry: true, rescan: false });
        return;
      }
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
        setProblem({ text: locationHelp(geo.ok ? null : geo.reason), canRetry: true, rescan: false });
      } else if (data.code === "TOO_FAR") {
        const rough = typeof data.studentAccuracy === "number" && data.studentAccuracy > 50;
        setProblem({
          text:
            `${data.error} ` +
            (rough
              ? `Your phone only knows where it is to about ${data.studentAccuracy} m, so it may be wrong. Step near a window or just outside the door, wait a moment, then try again.`
              : "If you are in the classroom, try again near a window. If it still fails, tell your teacher: they can mark you present or update the classroom location."),
          canRetry: true,
          rescan: false,
        });
      } else if (data.code === "EXPIRED" || data.code === "INVALID") {
        setProblem({ text: data.error, canRetry: false, rescan: true });
      } else {
        setProblem({ text: data.error ?? "Check-in failed. Please try again.", canRetry: true, rescan: false });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

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
        {phase === "locating" && (
          <>
            <p className="text-navy/80">Finding your location...</p>
            <p className="mt-2 text-xs text-navy/50">
              {accuracy === null
                ? "This can take up to 15 seconds. Keep this page open."
                : `Accurate to about ${accuracy} m so far. Getting a better reading...`}
            </p>
          </>
        )}
        {phase === "checking" && <p className="text-navy/80">Checking you in...</p>}
        {phase === "success" && (
          <>
            <p className="text-lg font-medium text-sage">
              {done?.again ? "You're already checked in." : "You're checked in!"}
            </p>
            {done?.className && <p className="mt-2 text-sm text-navy/70">{done.className}</p>}
            <p className="mt-4 text-xs text-navy/50">You can close this page.</p>
          </>
        )}
        {phase === "error" && problem && (
          <>
            <p className="mb-4 text-sm font-medium text-clay">{problem.text}</p>
            {problem.canRetry && (
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy"
              >
                Try again
              </button>
            )}
            {problem.rescan && (
              <Link
                href="/dashboard/my-schedule"
                className="inline-block rounded bg-navy px-4 py-2 text-sm font-medium text-parchment transition-all hover:bg-gold hover:text-navy"
              >
                Scan the new code
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
