"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { getLocation, type Fix } from "@/lib/browserLocation";

type Session = { token: string; expiresAt: string; locationSource?: "venue" | "device" | null } | null;
type AttendanceRecord = { id: string; student: { user: { name: string } }; status: string };
type ClassVenue = {
  name: string;
  venue: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  venueAccuracy: number | null;
  venueSavedAt: string | null;
};
type Note = { good: boolean; text: string } | null;

// A live position rougher than this can't check students fairly
const MAX_TEACHER_ACCURACY = 300;
// Saving the classroom location needs a precise position (the server checks this too)
const MAX_VENUE_ACCURACY = 100;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function ClassAttendancePage() {
  const params = useParams();
  const classId = params.classId as string;
  const [cls, setCls] = useState<ClassVenue | null>(null);
  const [session, setSession] = useState<Session>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState<"start" | "save" | "retry" | null>(null);
  const [deviceFix, setDeviceFix] = useState<Fix | null>(null);
  const [verify, setVerify] = useState(true);
  const [note, setNote] = useState<Note>(null);
  const [justArrived, setJustArrived] = useState<string | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const verifyRef = useRef(true);
  const prevCountRef = useRef<number | null>(null);

  const hasVenue = cls?.venueLatitude != null && cls?.venueLongitude != null;
  const canCheck = hasVenue || !!deviceFix;

  const loadClass = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}/venue`);
    if (res.ok) setCls(await res.json());
  }, [classId]);

  const loadRecords = useCallback(async () => {
    const res = await fetch(`/api/attendance?classId=${classId}`);
    if (!res.ok) return;
    const data: AttendanceRecord[] = await res.json();
    if (prevCountRef.current !== null && data.length > prevCountRef.current) {
      setJustArrived(data[data.length - 1].student.user.name);
      setTimeout(() => setJustArrived(null), 2500);
    }
    prevCountRef.current = data.length;
    setRecords(data);
  }, [classId]);

  // The server measures students from the saved classroom location if there is one,
  // otherwise from this device's live position (sent here when we have a good one)
  const createSession = useCallback(async () => {
    const body: Record<string, unknown> = { classId, checkLocation: verifyRef.current };
    if (fixRef.current) {
      body.latitude = fixRef.current.latitude;
      body.longitude = fixRef.current.longitude;
    }
    const res = await fetch("/api/attendance/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) setSession(await res.json());
  }, [classId]);

  // Used only when no classroom location is saved: try this device's own position
  async function findDeviceLocation() {
    const geo = await getLocation();
    if (geo.ok && geo.fix.accuracy <= MAX_TEACHER_ACCURACY) {
      fixRef.current = geo.fix;
      setDeviceFix(geo.fix);
      setNote({
        good: true,
        text: `Location check is on, using this device's position (to about ${Math.round(geo.fix.accuracy)} m). Save it as the classroom location below, and next time any device can run attendance here.`,
      });
      return;
    }
    fixRef.current = null;
    setDeviceFix(null);
    setNote({
      good: false,
      text:
        (geo.ok
          ? `This device can only find its location to about ${Math.round(geo.fix.accuracy)} m, which is too rough to check students fairly.`
          : geo.reason === "denied"
          ? "Location is blocked in this browser."
          : "This device couldn't find its location.") +
        " Students can check in without a location check. To check location, save the classroom location once from a phone inside the room.",
    });
  }

  async function startAttendance() {
    setNote(null);
    if (hasVenue) {
      setNote({
        good: true,
        text: "Location check is on, using this classroom's saved location. Students must be in or near the room.",
      });
      setActive(true);
      return;
    }
    setBusy("start");
    await findDeviceLocation();
    setBusy(null);
    setActive(true);
  }

  async function retryLocation() {
    setBusy("retry");
    await findDeviceLocation();
    setBusy(null);
    createSession(); // the next code carries the new location straight away
  }

  async function saveVenue() {
    setBusy("save");
    setNote(null);
    const geo = await getLocation();
    if (!geo.ok) {
      setNote({
        good: false,
        text:
          geo.reason === "denied"
            ? "Location is blocked in this browser. Allow it for this site, then try again."
            : "This device couldn't find its location. Turn Location on, move near a window, then try again.",
      });
      setBusy(null);
      return;
    }
    if (geo.fix.accuracy > MAX_VENUE_ACCURACY) {
      setNote({
        good: false,
        text: `This device only knows its position to about ${Math.round(geo.fix.accuracy)} m. Save the classroom location from a phone inside the room with Location on (it needs to be within ${MAX_VENUE_ACCURACY} m). Moving near a window helps.`,
      });
      setBusy(null);
      return;
    }

    const res = await fetch(`/api/classes/${classId}/venue`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geo.fix),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNote({ good: false, text: data.error ?? "The location couldn't be saved. Please try again." });
    } else {
      setCls(data);
      setNote({
        good: true,
        text: `Classroom location saved (to about ${Math.round(geo.fix.accuracy)} m). From now on students are checked against it, whichever device runs attendance.`,
      });
      if (active) createSession();
    }
    setBusy(null);
  }

  async function forgetVenue() {
    if (!window.confirm("Forget this classroom's saved location? Location checking will then depend on the device running attendance.")) return;
    const res = await fetch(`/api/classes/${classId}/venue`, { method: "DELETE" });
    if (res.ok) {
      setCls(await res.json());
      setNote({ good: false, text: "Classroom location forgotten. Save it again from a phone in the room when you can." });
      if (active) createSession();
    }
  }

  function toggleVerify(next: boolean) {
    setVerify(next);
    verifyRef.current = next;
    createSession(); // refresh the code so the change applies straight away
  }

  function stopAttendance() {
    setActive(false);
    setSession(null);
  }

  async function removeCheckin(id: string) {
    await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    loadRecords();
  }

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  useEffect(() => {
    loadRecords();
    const interval = setInterval(loadRecords, 5000);
    return () => clearInterval(interval);
  }, [loadRecords]);

  useEffect(() => {
    if (!active) return;
    createSession();
    const rotate = setInterval(createSession, 60 * 1000);
    return () => clearInterval(rotate);
  }, [active, createSession]);

  const checkinUrl = session
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/checkin/${session.token}`
    : "";

  const smallButton =
    "rounded border border-navy/20 px-3 py-1 text-sm text-navy transition-colors hover:border-gold hover:text-gold disabled:opacity-60";

  const venueBox = (
    <div className="mt-6 w-full rounded border border-navy/10 bg-white/60 p-4 text-left">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-navy/50">Classroom location</p>
      {hasVenue && cls?.venueSavedAt ? (
        <>
          <p className="text-sm text-navy">
            Saved on {formatDate(cls.venueSavedAt)}
            {cls.venueAccuracy != null && ` (to about ${Math.round(cls.venueAccuracy)} m)`}. Any device can run
            attendance here with location checking.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={saveVenue} disabled={busy !== null} className={smallButton}>
              {busy === "save" ? "Finding location..." : "Update from this device"}
            </button>
            <button onClick={forgetVenue} disabled={busy !== null} className={`${smallButton} hover:border-clay hover:text-clay`}>
              Forget
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-navy">
            Not saved yet. Stand in the room with a phone and save it once. After that, any device, even a laptop,
            can run attendance with location checking.
          </p>
          <button onClick={saveVenue} disabled={busy !== null} className={`${smallButton} mt-3`}>
            {busy === "save" ? "Finding location..." : "Save this room's location"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-navy">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-1 text-center font-display text-3xl tracking-wide text-parchment">
          Attendance Check-In
        </h1>
        <p className="mb-8 text-center text-sm text-parchment/70">
          {cls ? `${cls.name}${cls.venue ? ` · ${cls.venue}` : ""}` : "\u00a0"}
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[420px_1fr]">
          <div className="flex flex-col items-center rounded-lg border-t-4 border-gold bg-parchment p-8 shadow-2xl">
            {note && (
              <p
                className={`mb-4 w-full rounded border px-3 py-2 text-left text-xs ${
                  note.good ? "border-sage/30 bg-sage/10 text-sage" : "border-gold/40 bg-gold/10 text-navy"
                }`}
              >
                {note.text}
              </p>
            )}

            {active ? (
              <>
                {session ? (
                  <>
                    <div className="rounded-lg bg-white p-6 shadow-inner">
                      <QRCodeSVG value={checkinUrl} size={260} />
                    </div>
                    <p className="mt-5 break-all text-center text-xs text-navy/50">{checkinUrl}</p>
                    <button onClick={() => navigator.clipboard.writeText(checkinUrl)} className={`${smallButton} mt-2`}>
                      Copy link
                    </button>
                  </>
                ) : (
                  <p className="py-10 text-sm text-navy/60">Preparing the code...</p>
                )}

                {canCheck ? (
                  <label className="mt-4 flex items-center gap-2 text-sm text-navy">
                    <input type="checkbox" checked={verify} onChange={(e) => toggleVerify(e.target.checked)} />
                    Check students&apos; location
                  </label>
                ) : (
                  <button onClick={retryLocation} disabled={busy !== null} className={`${smallButton} mt-4`}>
                    {busy === "retry" ? "Finding location..." : "Try finding location again"}
                  </button>
                )}

                <p className="mt-4 flex items-center gap-2 text-sm text-navy/60">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sage" />
                  Live: a new code every 60 seconds (each works for 3 minutes)
                </p>
                <button
                  onClick={stopAttendance}
                  className="mt-6 w-full rounded bg-clay py-2.5 font-medium text-white transition-all hover:bg-clay/90"
                >
                  Stop Attendance
                </button>
              </>
            ) : (
              <button
                onClick={startAttendance}
                disabled={busy !== null}
                className="rounded bg-navy px-8 py-4 text-lg font-medium text-parchment transition-all hover:scale-105 hover:bg-gold hover:text-navy disabled:opacity-60"
              >
                {busy === "start" ? "Finding your location..." : "Start Attendance"}
              </button>
            )}

            {venueBox}
          </div>

          <div className="rounded-lg border-t-4 border-gold bg-parchment p-6 shadow-2xl">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-navy">Checked In</h2>
              <span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-white">
                {records.length}
              </span>
            </div>

            {justArrived && (
              <div className="mb-3 animate-pulse rounded border border-sage/40 bg-sage/10 px-3 py-2 text-sm font-medium text-sage">
                ✓ {justArrived} just checked in
              </div>
            )}

            {records.length === 0 ? (
              <p className="py-8 text-center text-sm text-navy/40">
                No one has checked in yet. The room fills up here as students scan.
              </p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded border border-navy/10 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy font-display text-sm text-parchment">
                        {r.student.user.name.charAt(0)}
                      </span>
                      <span className="font-medium text-navy">{r.student.user.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sage">
                        {r.status}
                      </span>
                      <button
                        onClick={() => removeCheckin(r.id)}
                        className="text-xs text-clay transition-colors hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}